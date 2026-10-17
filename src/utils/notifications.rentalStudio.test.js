import { notificationDestination } from './notifications';
test.each([
  [{ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { role: 'admin' }],
  [{ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { activeMode: 'seller' }],
  [{ audience: 'CUSTOMER', metadata: { rentalWaitlistId: 'wait1' } }, { role: 'customer' }],
  [{ audience: 'ADMIN', storeId: 'store2', metadata: { rentalBookingId: 'refund1' } }, { activeMode: 'seller' }],
  [{ audience: 'CUSTOMER', metadata: { rentalBookingId: 'trial1', storeSlug: 'baldev' } }, { role: 'customer' }],
])('historical rental notification %# has no unavailable rental destination', (item, user) => {
  expect(notificationDestination(item, user)).toBe('');
});
