import React, { createContext, useCallback, useContext, useState } from 'react';

export type Duration = '1_month' | '1_year' | '2_years';

export const DURATION_LABELS: Record<Duration, string> = {
  '1_month': '1 mois',
  '1_year':  '1 an (-10%)',
  '2_years': '2 ans (-20%)',
};

export const DURATION_DISCOUNT: Record<Duration, number> = {
  '1_month': 1,
  '1_year':  0.9,
  '2_years': 0.8,
};

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  duration: Duration;
  available: boolean;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, delta: number) => void;
  updateDuration: (id: string, duration: Duration) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const id = `${newItem.productId}_${newItem.duration}`;
    setItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...newItem, id, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    );
  }, []);

  const updateDuration = useCallback((id: string, duration: Duration) => {
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i;
        return { ...i, id: `${i.productId}_${duration}`, duration };
      })
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = items.reduce((acc, i) => acc + i.quantity, 0);
  const total = items.reduce((acc, i) => {
    if (!i.available) return acc;
    return acc + i.price * i.quantity * DURATION_DISCOUNT[i.duration];
  }, 0);

  return (
    <CartContext.Provider value={{ items, count, total, addItem, removeItem, updateQty, updateDuration, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
