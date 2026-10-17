import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import api from '../../services/api';
import ImageUploader from '../../components/admin/ImageUploader';
import ProductSmartFill from '../../components/admin/ProductSmartFill';
import ProductAttributeField from '../../components/admin/ProductAttributeField';
import { isTechnologyCatalog } from '../../utils/catalogPresentation';
import { changeProductCategory, draftAttributeDefinitions, firstInvalidDraftAttribute } from '../../utils/draftAttributes';
import { applySmartPatch, automaticSpecificationPatch, smartInputSignature, smartProvider, smartRequest, snapshotForm, suggestionRows } from '../../utils/productSmartFill';
import PageHeader from '../../components/admin/PageHeader';
import ImportSizeFields from '../../components/admin/ImportSizeFields';
import { asCatalogList, fetchSubcategories } from '../../utils/catalogOptions';
import { importSizingProduct } from '../../utils/socialImport';
import { buildSizeChartPayload, getSelectableSizes, getSizeChartValidation, resolveSizingMode } from '../../utils/productSizing';
import './SocialProductImport.css';
import {
  applyVisionSuggestion,
  buildQuickAddPayload,
  emptyQuickAddForm,
  suggestListingCopy,
  suggestProductName,
  validateQuickAdd,
} from '../../utils/quickAddProduct';

export default function QuickAddProduct() {
  const [form, setForm] = useState(() => emptyQuickAddForm());
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [visionNote, setVisionNote] = useState('');
  const [visionSources, setVisionSources] = useState([]);
  const [visionEnabled, setVisionEnabled] = useState(null);
  const [created, setCreated] = useState(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [copyTouched, setCopyTouched] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [structure, setStructure] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(true);
  const technologyCatalog = isTechnologyCatalog(structure);
  const attributes = draftAttributeDefinitions(structure, categories, form);

  const nameTouchedRef = useRef(false);
  const copyTouchedRef = useRef(false);
  const categoryTouchedRef = useRef(false);
  const categoriesRef = useRef([]);
  const visionEnabledRef = useRef(null);
  const analyzedUrlRef = useRef('');
  const analyzeTokenRef = useRef(0);
  const currentForm = useRef(form); currentForm.current = form;
  const visionStatusRequest = useRef(null);
  const activeAnalysis = useRef(null);

  useEffect(() => { nameTouchedRef.current = nameTouched; }, [nameTouched]);
  useEffect(() => { copyTouchedRef.current = copyTouched; }, [copyTouched]);
  useEffect(() => { categoryTouchedRef.current = categoryTouched; }, [categoryTouched]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { visionEnabledRef.current = visionEnabled; }, [visionEnabled]);

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      const [configuration, items] = await Promise.all([api.get('/catalog-configuration'), api.get('/admin/categories?admin=true')]);
      setStructure(configuration);
      setCategories(asCatalogList(items));
    } catch (error) {
      setSetupError(error.message || 'Product options could not load.');
    } finally { setSetupLoading(false); }
  }, []);
  useEffect(() => { loadSetup(); }, [loadSetup]);

  useEffect(() => {
    if (!structure) return undefined;
    let alive = true;
    visionStatusRequest.current = api.get(technologyCatalog ? '/admin/products/smart-fill/status' : '/admin/products/quick-analyze/status', { silent: true, cache: 'no-store' })
      .then((status) => {
        if (!alive) return status;
        visionEnabledRef.current = Boolean(status?.enabled);
        setVisionEnabled(Boolean(status?.enabled));
        if (!status?.enabled) {
          setVisionNote(status?.reason || 'Photo AI is not configured on the backend. Enter product details manually.');
        }
        return status;
      })
      .catch(() => {
        if (!alive) return null;
        visionEnabledRef.current = false;
        setVisionEnabled(false);
        setVisionNote('Could not check photo AI status. Restart the backend, then refresh this page.');
        return null;
      });
    return () => { alive = false; analyzeTokenRef.current += 1; activeAnalysis.current?.abort(); };
  }, [structure, technologyCatalog]);

  useEffect(() => {
    let alive = true;
    fetchSubcategories(api, form.category).then((items) => {
      if (alive) setSubcategories(items);
    });
    return () => { alive = false; };
  }, [form.category]);

  const applyCopy = (next, categoryName) => {
    if (copyTouchedRef.current) return next;
    const copy = suggestListingCopy({ name: next.name, categoryName });
    return { ...next, ...copy, categoryName };
  };

  const update = (field, value) => {
    setForm((current) => {
      const next = field === 'category' ? changeProductCategory(current, value, structure, categories) : { ...current, [field]: value };
      if (field === 'brand' && structure?.attributes?.some(attribute => attribute.key === 'brand')) {
        next.attributeValues = { ...current.attributeValues, brand: value };
      }
      if (field === 'countryOfOrigin' && structure?.attributes?.some(attribute => attribute.key === 'country_of_origin')) {
        next.attributeValues = { ...current.attributeValues, country_of_origin: value };
      }
      if (field === 'category') {
        const categoryName = categories.find((item) => item._id === value)?.name || '';
        next.subCategory = '';
        if (!nameTouchedRef.current && !String(next.name || '').trim() && categoryName) {
          next.name = categoryName;
        }
        return applyCopy(next, categoryName);
      }
      if (field === 'name') return applyCopy(next, current.categoryName || categories.find((item) => item._id === current.category)?.name || '');
      return next;
    });
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const applyFilenameFallback = (images) => {
    if (nameTouchedRef.current) return;
    setForm((current) => {
      const suggested = suggestProductName(images || current.images, current.name);
      if (!suggested) return current;
      const next = { ...current, name: suggested };
      const categoryName = current.categoryName || categoriesRef.current.find((item) => item._id === current.category)?.name || '';
      return applyCopy(next, categoryName);
    });
  };

  const analyzePhoto = async (imageUrl, images) => {
    const token = ++analyzeTokenRef.current;
    activeAnalysis.current?.abort();
    const controller = new AbortController(); activeAnalysis.current = controller;
    const baseline = snapshotForm(currentForm.current);
    setAnalyzing(true);
    setVisionSources([]);
    setVisionNote(visionEnabledRef.current === false
      ? 'Photo AI is not configured. Enter the exact product model.'
      : 'Looking at the product…');
    try {
      const status = await visionStatusRequest.current;
      if (controller.signal.aborted || token !== analyzeTokenRef.current) return;
      if (!status?.enabled) {
        setVisionNote('Photo AI is not configured on the backend. Enter the exact product model and specifications.');
        applyFilenameFallback(images); return;
      }
      if (technologyCatalog) {
        let preference = ''; try { preference = localStorage.getItem('baldev_product_ai_provider') || ''; } catch { /* Optional preference. */ }
        const result = await api.post('/admin/products/smart-fill', smartRequest(baseline, '', images.map(item => typeof item === 'string' ? item : item.url).filter(Boolean).slice(0, 4), true, smartProvider(status, preference)), { silent: true, signal: controller.signal });
        if (controller.signal.aborted || token !== analyzeTokenRef.current) return;
        const unchanged = smartInputSignature(currentForm.current, {}) === smartInputSignature(baseline, {});
        setForm(current => {
          if (smartInputSignature(current, {}) !== smartInputSignature(baseline, {})) return current;
          const generated = applyVisionSuggestion(current, { ...result.suggestion, categoryId: result.suggestion?.category }, {
            name: nameTouchedRef.current, copy: copyTouchedRef.current, category: categoryTouchedRef.current,
          }, categoriesRef.current, draftAttributeDefinitions(structure, categoriesRef.current, { ...current, category: current.category || result.suggestion?.category }));
          if (!unchanged || result.specificationLookup?.status === 'failed') return generated;
          const rows = suggestionRows(result, generated, { categories: categoriesRef.current, structure, seo: false });
          return applySmartPatch(generated, automaticSpecificationPatch(rows, generated));
        });
        setVisionSources(result.webSources || []); setMoreOpen(true);
        setVisionNote(result.specificationLookup?.status === 'completed'
          ? unchanged ? 'Internet specifications filled where verified. Review the fields, then add price and stock.' : 'Product details changed during analysis. Run Smart Fill again to fill specifications for the updated model.'
          : `Specifications were not fetched: ${result.specificationLookup?.message || result.warnings?.[0] || 'Enter an exact model and run Smart Fill.'}`);
        return;
      }
      const result = await api.post('/admin/products/quick-analyze', {
        imageUrl,
        categories: categoriesRef.current.map((item) => ({ _id: item._id, name: item.name })),
        subcategories,
      });
      if (token !== analyzeTokenRef.current) return;

      if (!result?.enabled) {
        setVisionEnabled(false);
        setVisionNote(result?.reason || 'Photo AI is not configured. Enter product details manually.');
        applyFilenameFallback(images);
        return;
      }

      setVisionEnabled(true);
      if (!result?.suggestion?.name) {
        setVisionNote('Could not identify this product clearly. Try a brighter front photo, or fill the fields yourself.');
        applyFilenameFallback(images);
        return;
      }

      const extras = result.suggestion.fabric || result.suggestion.occasion || result.suggestion.colors?.length || result.suggestion.tags?.length || result.suggestion.brand || result.suggestion.packageDimensions || result.suggestion.shippingWeightKg;
      setForm((current) => applyVisionSuggestion(current, result.suggestion, {
        name: nameTouchedRef.current,
        copy: copyTouchedRef.current,
        category: categoryTouchedRef.current,
      }, categoriesRef.current, draftAttributeDefinitions(structure, categoriesRef.current, { ...current, category: current.category || result.suggestion.category })));
      if (extras) setMoreOpen(true);
      setVisionNote('Identified from the photo. Check the fields, then add price and stock.');
    } catch (error) {
      if (token !== analyzeTokenRef.current) return;
      setVisionNote(error.message || 'Could not read this photo. You can still add the product.');
      applyFilenameFallback(images);
    } finally {
      if (token === analyzeTokenRef.current) setAnalyzing(false);
      if (activeAnalysis.current === controller) activeAnalysis.current = null;
    }
  };

  const onImagesChange = (images) => {
    setForm((current) => ({ ...current, images }));
    if (errors.images) setErrors((current) => ({ ...current, images: undefined }));

    const firstUrl = images[0]?.url || '';
    if (!firstUrl) {
      analyzeTokenRef.current += 1;
      activeAnalysis.current?.abort(); setVisionSources([]);
      analyzedUrlRef.current = '';
      setAnalyzing(false);
      if (visionEnabledRef.current === false) {
        setVisionNote('Photo AI is not configured. Enter product details manually.');
      } else {
        setVisionNote('');
      }
      return;
    }
    if (firstUrl === analyzedUrlRef.current) return;
    analyzedUrlRef.current = firstUrl;

    // Do not fill from the phone filename first — wait for vision when AI is on.
    if (visionEnabledRef.current === false) {
      applyFilenameFallback(images);
      setVisionNote('Photo AI is unavailable. The suggested name uses the file name; enter the exact product model.');
      return;
    }
    analyzePhoto(firstUrl, images);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || mediaBusy || analyzing || setupLoading || setupError || !structure) return;
    const nextErrors = validateQuickAdd(form);
    const sizing = importSizingProduct(form, categories, structure);
    if (!getSizeChartValidation(sizing).valid) nextErrors.sizing = 'Complete the available sizes and actual measurements below.';
    if (!Number.isSafeInteger(Number(form.stock)) || Number(form.stock) < 0) nextErrors.stock = 'Enter a whole-number stock quantity.';
    if (!Number.isFinite(Number(form.price))) nextErrors.price = 'Enter a valid selling price.';
    const invalidAttribute = firstInvalidDraftAttribute(attributes, form.attributeValues);
    if (invalidAttribute) nextErrors[invalidAttribute.key] = invalidAttribute.message;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setMessage('');
    try {
      const selectedCategory = categories.find((item) => item._id === form.category);
      const payload = buildQuickAddPayload({
        ...form,
        categoryName: selectedCategory?.name || '',
      });
      Object.assign(payload, {
        attributeValues: form.attributeValues || {},
        sizingMode: resolveSizingMode(sizing),
        sizeChartProfile: sizing.sizeChartProfile || 'auto',
        sizes: getSelectableSizes(sizing),
        sizeChart: buildSizeChartPayload(sizing),
      });
      if (!payload.category) delete payload.category;
      const product = await api.post('/admin/products', payload);
      const createdProduct = product?._id ? product : product?.data || product?.product;
      if (!createdProduct?._id) throw new Error('Product was created, but the response was incomplete.');
      setCreated(createdProduct);
      setMessage('Product added');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const addAnother = () => {
    analyzeTokenRef.current += 1;
    analyzedUrlRef.current = '';
    setForm(emptyQuickAddForm());
    setErrors({});
    setCreated(null);
    activeAnalysis.current?.abort(); setVisionSources([]);
    setMessage('');
    setVisionNote(visionEnabledRef.current === false
      ? 'Photo AI is not configured. Enter product details manually.'
      : '');
    setAnalyzing(false);
    setNameTouched(false);
    setCopyTouched(false);
    setCategoryTouched(false);
    setMoreOpen(false);
  };

  if (created?._id) {
    return (
      <section className="space-y-5">
        <PageHeader title="Quick Add Product" note="The listing is in the catalog. You can add another or open the full editor." />
        <div className="admin-form-card">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf8f0] text-[#2f8a52]">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <h2>Product added</h2>
              <p className="admin-form-card__note">{created.name}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`/admin/products/edit?id=${created._id}`} className="admin-btn">View Product</a>
            <button type="button" onClick={addAnother} className="admin-btn-ghost">
              <Plus className="h-4 w-4" />
              Add Another
            </button>
            <a href="/admin/products" className="admin-btn-ghost">Back to catalog</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader title="Quick Add Product" note="Upload a product photo, review the suggested details, then add price and stock.">
        <a href="/admin/social-import" className="admin-btn-ghost">Import Instagram / Facebook link</a>
        <a href="/admin/products/add" className="admin-btn-ghost">Open Advanced Add Product</a>
      </PageHeader>

      {visionEnabled === false && (
        <div className="admin-quick-add__banner" role="status">
          <strong>Photo AI is unavailable</strong>
          <p>Enter the exact model and review the product details manually. Smart Fill can fetch specifications when AI is available.</p>
        </div>
      )}

      <form onSubmit={submit} className="admin-quick-add">
        {setupError && <p role="alert">{setupError} <button type="button" className="admin-btn-ghost" onClick={loadSetup}>Retry product options</button></p>}
        <div className="admin-form-card">
          <h2>Photos</h2>
          <p className="admin-form-card__note">
            {visionEnabled
              ? 'AI reads the first photo to identify the product and visible model details.'
              : 'The first photo becomes the main image. Enter the product model or use Smart Fill.'}
          </p>
          <div className="mt-4">
            <ImageUploader
              label="Drop product photos here"
              helpText="JPG, JPEG, PNG or WEBP. Upload starts immediately."
              multiple
              maxFiles={8}
              uploadContext="products"
              uploadPath="/admin/uploads"
              compressAboveMb={2}
              maxUploadMb={20}
              targetSizeMb={0.7}
              showPrimaryControl={false}
              value={form.images}
              disabled={saving || setupLoading || !structure}
              onBusyChange={setMediaBusy}
              onChange={onImagesChange}
            />
            {analyzing && <p className="admin-quick-add__status is-busy">Looking at the product…</p>}
            {!analyzing && visionNote && <p className="admin-quick-add__status">{visionNote}</p>}
            {!analyzing && !!visionSources.length && <div className="product-smart-fill__sources" aria-label="AI specification sources">{visionSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>)}</div>}
            {errors.images && <p className="admin-field__error mt-2">{errors.images}</p>}
          </div>

          {attributes.map(attribute => <ProductAttributeField key={attribute.key} attribute={attribute} value={form.attributeValues?.[attribute.key] ?? ''} error={errors[attribute.key]} onChange={value => { if (attribute.key === 'brand') update('brand', value); else if (attribute.key === 'country_of_origin') update('countryOfOrigin', value); else update('attributeValues', { ...form.attributeValues, [attribute.key]: value }); setErrors(current => ({ ...current, [attribute.key]: undefined })); }} />)}
          {structure && <div className="mt-4"><ImportSizeFields form={form} onUpdate={update} categories={categories} structure={structure} />{errors.sizing && <p role="alert" className="admin-field__error">{errors.sizing}</p>}</div>}
        </div>

        <div className="admin-form-card">
          <h2>Review</h2>
          <p className="admin-form-card__note">Review the product details and confirm your available stock.</p>
          <div className="mt-4"><ProductSmartFill form={form} categories={categories} structure={structure} seo={false} disabled={saving || analyzing || !structure}
            onApply={(patch, undo) => {
              nameTouchedRef.current = true; copyTouchedRef.current = true; categoryTouchedRef.current = true;
              setNameTouched(true); setCopyTouched(true); setCategoryTouched(true);
              setForm(current => {
                const next = applySmartPatch(current, patch, undo);
                return { ...next, categoryName: categories.find(item => item._id === next.category)?.name || '' };
              });
              setMoreOpen(true); setErrors({});
            }} /></div>

          <div className="mt-4 grid gap-4">
            <label className="admin-field">
              <span>Product name<em>*</em></span>
              <input
                value={form.name}
                onChange={(event) => {
                  setNameTouched(true);
                  update('name', event.target.value);
                }}
                className={`admin-field__control${errors.name ? ' is-error' : ''}`}
                placeholder={analyzing ? 'Identifying from photo…' : 'Filled after the photo is read'}
              />
              {errors.name && <span className="admin-field__error">{errors.name}</span>}
            </label>

            <div className="admin-field">
              <span>Category<em>*</em></span>
              <div className="admin-quick-add__chips">
                {categories.map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    className={`admin-quick-add__chip${form.category === category._id ? ' is-on' : ''}`}
                    onClick={() => {
                      setCategoryTouched(true);
                      update('category', category._id);
                    }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              {errors.category && <span className="admin-field__error">{errors.category}</span>}
              {!categories.length && <span className="admin-field__error">No categories loaded yet.</span>}
            </div>

            {form.category ? (
              <div className="admin-field">
                <span>Subcategory</span>
                {subcategories.length ? (
                  <div className="admin-quick-add__chips">
                    {subcategories.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`admin-quick-add__chip${form.subCategory === item ? ' is-on' : ''}`}
                        onClick={() => update('subCategory', form.subCategory === item ? '' : item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="admin-form-card__note">No subcategories in this category yet. Type one below if needed.</p>
                )}
                <input
                  value={form.subCategory}
                  onChange={(event) => update('subCategory', event.target.value)}
                  className="admin-field__control mt-2"
                  placeholder="Optional"
                />
              </div>
            ) : null}

            <div className="admin-quick-add__row">
              <label className="admin-field">
                <span>Selling price<em>*</em></span>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  className={`admin-field__control${errors.price ? ' is-error' : ''}`}
                  placeholder="1499"
                />
                {errors.price && <span className="admin-field__error">{errors.price}</span>}
              </label>
              <label className="admin-field">
                <span>Stock<em>*</em></span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => update('stock', event.target.value)}
                  className={`admin-field__control${errors.stock ? ' is-error' : ''}`}
                  placeholder="10"
                />
                {errors.stock && <span className="admin-field__error">{errors.stock}</span>}
              </label>
            </div>

            <label className="admin-field">
              <span>Prepared details</span>
              <textarea
                value={form.description}
                onChange={(event) => {
                  setCopyTouched(true);
                  update('description', event.target.value);
                }}
                className="admin-field__control"
                placeholder="Filled after the photo is read"
              />
            </label>
          </div>

          <details className="admin-quick-add__more" open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)}>
            <summary>
              More Options
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="admin-quick-add__more-grid">
              <label className="admin-field">
                <span>Original price</span>
                <input type="number" min="0" value={form.originalPrice} onChange={(event) => update('originalPrice', event.target.value)} className="admin-field__control" placeholder="1999" />
              </label>
              <label className="admin-field">
                <span>Brand</span>
                <input value={form.brand} onChange={(event) => update('brand', event.target.value)} className="admin-field__control" />
              </label>
              <label className="admin-field"><span>Country of origin</span><input value={form.countryOfOrigin || ''} onChange={(event) => update('countryOfOrigin', event.target.value)} className="admin-field__control" /></label>
              <label className="admin-field"><span>Packed weight (kg)</span><input type="number" min="0" step="0.01" value={form.shippingWeightKg ?? ''} onChange={(event) => update('shippingWeightKg', event.target.value)} className="admin-field__control" />{errors.shippingWeightKg && <span className="admin-field__error">{errors.shippingWeightKg}</span>}</label>
              {['lengthCm', 'widthCm', 'heightCm'].map((key) => <label key={key} className="admin-field"><span>Package {key.replace('Cm', '')} (cm)</span><input type="number" min="0" step="0.1" value={form.packageDimensions?.[key] ?? ''} onChange={(event) => update('packageDimensions', { ...form.packageDimensions, [key]: event.target.value })} className="admin-field__control" /></label>)}
              {errors.packageDimensions && <p className="admin-field__error">{errors.packageDimensions}</p>}
              <label className="admin-field"><span>Highlights</span><input value={form.highlights || ''} onChange={event => update('highlights', event.target.value)} className="admin-field__control" placeholder="Separate highlights with commas" /></label>
              {!technologyCatalog && <><label className="admin-field">
                <span>Fabric</span>
                <input value={form.fabric} onChange={(event) => update('fabric', event.target.value)} className="admin-field__control" placeholder="Silk" />
              </label>
              <label className="admin-field">
                <span>Occasion</span>
                <input value={form.occasion} onChange={(event) => update('occasion', event.target.value)} className="admin-field__control" placeholder="Wedding" />
              </label></>}
              <label className="admin-field">
                <span>Tags</span>
                <input value={form.tags} onChange={(event) => update('tags', event.target.value)} className="admin-field__control" placeholder={technologyCatalog ? 'USB-C, wireless, fast charging' : 'Product search tags'} />
              </label>
              <label className="admin-field">
                <span>Colors</span>
                <input value={form.colors} onChange={(event) => update('colors', event.target.value)} className="admin-field__control" placeholder={technologyCatalog ? 'Black, White, Blue' : 'Product colours'} />
              </label>
            </div>
          </details>

          <p className="admin-quick-add__escape">
            Need more control? <a href="/admin/products/add">Open Advanced Add Product</a>
          </p>
        </div>

        {message && !created && <p role="status" className="admin-quick-add__message">{message}</p>}

        <div className="admin-form-actions admin-quick-add__actions">
          <a href="/admin/products" className="admin-btn-ghost">Cancel</a>
          <button type="submit" disabled={saving || mediaBusy || analyzing || setupLoading || Boolean(setupError) || !structure} className="admin-btn disabled:opacity-60">
            {saving ? 'Saving...' : analyzing ? 'Reading photo…' : 'Looks good, add product'}
          </button>
        </div>
      </form>
    </section>
  );
}
