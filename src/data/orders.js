const ORDERS_KEY = 'caracole-browser-orders'

export function getOrders() {
  if (typeof window === 'undefined') return []
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    return Array.isArray(orders) ? orders : []
  } catch {
    return []
  }
}

export function saveOrder(order) {
  const orders = [{ ...order, storedLocally: true }, ...getOrders()].slice(0, 50)
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  return orders
}
