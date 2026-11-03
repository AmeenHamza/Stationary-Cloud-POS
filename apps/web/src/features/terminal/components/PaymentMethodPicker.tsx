'use client';

import { PAYMENT_METHODS } from '@pos/contracts';

import { PAYMENT_METHOD_LABEL } from '@/components/ledger/khata-labels';
import { Button } from '@/components/ui/button';
import { UdhaarCustomerPicker } from '@/features/customers';

import { useCart } from '../state/CartProvider';

/** The six methods (F-22); Udhaar puts the whole bill on a picked or quick-added customer (D-15). */
export function PaymentMethodPicker() {
  const { cart, dispatch } = useCart();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Payment method</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAYMENT_METHODS.map((method) => (
          <Button
            key={method}
            type="button"
            variant={cart.paymentMethod === method ? 'default' : 'outline'}
            aria-pressed={cart.paymentMethod === method}
            onClick={() => {
              dispatch({ type: 'setPaymentMethod', paymentMethod: method });
            }}
          >
            {PAYMENT_METHOD_LABEL[method]}
          </Button>
        ))}
      </div>
      {cart.paymentMethod === 'UDHAAR' && (
        <>
          <p className="text-sm">
            {cart.customer === null
              ? 'Choose the customer for this Udhaar bill.'
              : `Udhaar to ${cart.customer.name}`}
          </p>
          <UdhaarCustomerPicker
            value={cart.customer}
            onChange={(customer) => {
              dispatch({ type: 'setCustomer', customer });
            }}
          />
        </>
      )}
    </fieldset>
  );
}
