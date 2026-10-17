import { Select, TextArea, TextInput } from '../ui/Field';
import ProductAttributeField from './ProductAttributeField';
import { draftAttributeDefinitions } from '../../utils/draftAttributes';
import { uploadAttributeFields, uploadAttributeValue } from '../../utils/draftUploadDetails';

export default function DraftUploadDetailsFields({ details, onChange, categories, structure, disabled, shared = false, identityOnly = false, additionalOnly = false }) {
  const attributes = draftAttributeDefinitions(structure, categories, details);
  const attribute = key => {
    const definition = attributes.find(item => item.key === key) || { key, label: { model: 'Exact model', brand: 'Brand', condition: 'Condition', warranty: 'Warranty period', ram: 'RAM', storage: 'Storage', colour: 'Colour', country_of_origin: 'Country of origin' }[key], type: ['ram', 'storage'].includes(key) ? 'number' : 'text', unit: ['ram', 'storage'].includes(key) ? 'GB' : '' };
    const maxLength = ['model', 'brand', 'colour', 'country_of_origin'].includes(key) ? 120 : 500;
    return <ProductAttributeField key={key} attribute={{ ...definition, ...(key === 'model' ? { label: 'Exact model' } : {}), validation: { ...definition.validation, maxLength: Math.min(maxLength, definition.validation?.maxLength || maxLength) }, required: false }} value={uploadAttributeValue(details, key)} disabled={disabled} onChange={value => onChange('attribute.' + key, value)} />;
  };
  const text = (key, label, maxLength = 120, multiline = false) => <label key={key} className={multiline ? 'draft-upload-wide' : ''}>{label}{multiline
    ? <TextArea rows={3} maxLength={maxLength} value={details[key] || ''} disabled={disabled} onChange={event => onChange(key, event.target.value)} />
    : <TextInput maxLength={maxLength} value={details[key] || ''} disabled={disabled} onChange={event => onChange(key, event.target.value)} />}</label>;
  const number = (key, label, max, integer = false) => <label key={key}>{label}<TextInput type="number" min="0" max={max} step={integer ? '1' : '0.01'} value={details[key] ?? ''} disabled={disabled} onChange={event => onChange(key, event.target.value)} /></label>;
  const category = <label key="category">Category<Select value={details.category || ''} disabled={disabled} onChange={event => onChange('category', event.target.value)}><option value="">Choose category</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></label>;
  const core = new Set(Object.keys(uploadAttributeFields));
  const extra = attributes.filter(item => (additionalOnly ? !item.required && !['brand', 'condition', 'country_of_origin', 'colour'].includes(item.key) : !core.has(item.key)) && (!shared || !['gtin', 'mpn'].includes(item.key)));
  const extraField = item => <ProductAttributeField key={item.key} attribute={{ ...item, required: false }} value={details.attributeValues?.[item.key] || ''} disabled={disabled} onChange={value => onChange('attribute.' + item.key, value)} />;
  if (identityOnly) return <div className="draft-upload-group__fields">
    {!shared && text('name', 'Product name', 180)}{category}
    {!shared && attribute('model')}{attribute('brand')}
    {!shared && ['ram', 'storage'].filter(key => attributes.some(item => item.key === key)).map(attribute)}
  </div>;
  return <>
    {!additionalOnly && <div className="draft-upload-group__fields">
      {!shared && text('name', 'Product name', 180)}{category}
      {!shared && attribute('model')}{attribute('brand')}{attribute('condition')}
      {!shared && ['ram', 'storage'].filter(key => attributes.some(item => item.key === key)).map(attribute)}
      {attribute('warranty')}{attribute('colour')}
      {!shared && number('sellingPrice', 'Selling price')}{!shared && number('originalPrice', 'MRP')}
      {number('stock', 'Stock quantity', undefined, true)}{number('gstRate', 'GST rate (%)', 100)}
      {extra.filter(item => item.required).map(extraField)}
    </div>}
    <details className="draft-upload-more"><summary>{shared ? 'More shared details' : 'Cost, identifiers & supplier'}</summary><div className="draft-upload-group__fields">
      {shared && number('sellingPrice', 'Selling price')}{shared && number('originalPrice', 'MRP')}{number('costPrice', 'Cost price')}
      {!shared && text('sku', 'SKU', 100)}{!shared && text('barcode', 'Barcode', 100)}{text('hsnCode', 'HSN code', 20)}
      {text('supplierName', 'Supplier name', 160)}{!shared && text('supplierSku', 'Supplier SKU', 100)}
      {number('lowStockAlert', 'Low-stock alert', undefined, true)}{number('reorderQuantity', 'Reorder quantity', undefined, true)}
    </div></details>
    <details className="draft-upload-more"><summary>Shipping & returns</summary><div className="draft-upload-group__fields">
      {number('shippingWeightKg', 'Packed weight (kg)', 1000)}{attribute('country_of_origin')}
      {['lengthCm', 'widthCm', 'heightCm'].map((key, index) => <label key={key}>{['Packed length (cm)', 'Packed width (cm)', 'Packed height (cm)'][index]}<TextInput type="number" min="0" max="1000" step="0.01" value={details.packageDimensions?.[key] ?? ''} disabled={disabled} onChange={event => onChange('packageDimensions.' + key, event.target.value)} /></label>)}
      {number('returnWindowDays', 'Return window (days)', 365, true)}{text('manufacturerDetails', 'Manufacturer details', 1000, true)}{text('returnPolicy', 'Return policy', 2000, true)}
    </div></details>
    {!!extra.filter(item => !item.required).length && <details className="draft-upload-more"><summary>All specifications</summary><div className="draft-upload-group__fields">{extra.filter(item => !item.required).map(extraField)}</div></details>}
    {!shared && <details className="draft-upload-more"><summary>Description & care</summary><div className="draft-upload-group__fields">{text('shortDescription', 'Short description', 240, true)}{text('description', 'Full description', 5000, true)}{text('careInstructions', 'Use and care instructions', 2000, true)}</div></details>}
  </>;
}
