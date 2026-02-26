import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addToInventory,
  createGroceryItem,
  deleteGroceryItem,
  getGroceryItems,
  getGroceryStatistics,
  getUserInventory,
  markGroceryItemPurchased,
  removeFromInventory,
} from '../services';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Button, Card, Input, Modal, PageContainer, SectionHeader, Select } from '../components/ui';

const categories = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Bakery', 'Frozen', 'Other'];

const GroceryList = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemData, inventoryData, statData] = await Promise.all([
        getGroceryItems(),
        getUserInventory(),
        getGroceryStatistics(),
      ]);
      setItems(itemData);
      setInventory(inventoryData);
      setStats(statData);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load grocery data.');
    } finally {
      setLoading(false);
    }
  };

  const groupedItems = useMemo(() => {
    const grouped = {};
    items.forEach((item) => {
      const key = item.category || 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }, [items]);

  if (loading) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <AppHeader title="Grocery Management" subtitle="Shopping and inventory" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
      <PageContainer>
        <SectionHeader
          title="Grocery Workspace"
          subtitle="Track shopping items and kitchen inventory in one place."
          actions={
            <div className="flex gap-2">
              <Button variant={activeTab === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('list')}>Shopping List</Button>
              <Button variant={activeTab === 'inventory' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('inventory')}>Inventory</Button>
              <Button variant={activeTab === 'stats' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('stats')}>Statistics</Button>
            </div>
          }
        />
        {error ? <Card className="mb-4 border-rose-900 bg-rose-900/20 text-rose-300">{error}</Card> : null}

        {activeTab === 'list' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowItemModal(true)}><Plus className="h-4 w-4" />Add item</Button>
            </div>
            {Object.keys(groupedItems).map((category) => (
              <Card key={category}>
                <h3 className="mb-3">{category}</h3>
                <div className="space-y-2">
                  {groupedItems[category].map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                      <div>
                        <p className={`text-sm ${item.is_purchased ? 'line-through app-muted' : ''}`}>{item.name}</p>
                        <p className="text-xs app-muted">{item.quantity || '1'} {item.unit || ''}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => markGroceryItemPurchased(item.id, !item.is_purchased).then(loadData)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteGroceryItem(item.id).then(loadData)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowInventoryModal(true)}><Plus className="h-4 w-4" />Add inventory</Button>
            </div>
            <div className="app-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {inventory.map((item) => (
                <Card key={item.id}>
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="capitalize">{item.ingredient_name}</h3>
                    <Button variant="danger" size="sm" onClick={() => removeFromInventory(item.ingredient_name).then(loadData)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs app-muted">Qty: {item.quantity || '-'}</p>
                  <p className="text-xs app-muted">Location: {item.location || '-'}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="app-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card><p className="app-muted text-xs">Total Items</p><h3>{stats.totalItems || 0}</h3></Card>
            <Card><p className="app-muted text-xs">To Buy</p><h3>{stats.unpurchasedItems || 0}</h3></Card>
            <Card><p className="app-muted text-xs">Purchased</p><h3>{stats.purchasedItems || 0}</h3></Card>
            <Card><p className="app-muted text-xs">From Meal Plans</p><h3>{stats.fromMealPlan || 0}</h3></Card>
          </div>
        )}
      </PageContainer>

      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title="Add grocery item">
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            await createGroceryItem({
              name: formData.get('name'),
              category: formData.get('category'),
              quantity: formData.get('quantity'),
              estimatedPrice: formData.get('estimatedPrice'),
              dueDate: formData.get('dueDate'),
            });
            setShowItemModal(false);
            event.currentTarget.reset();
            loadData();
          }}
        >
          <Input name="name" placeholder="Item name" required />
          <Select name="category" required>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </Select>
          <Input name="quantity" placeholder="Quantity" />
          <Input type="number" name="estimatedPrice" placeholder="Estimated price" />
          <Input type="date" name="dueDate" />
          <Button type="submit" className="w-full">Save Item</Button>
        </form>
      </Modal>

      <Modal open={showInventoryModal} onClose={() => setShowInventoryModal(false)} title="Add inventory item">
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            await addToInventory({
              name: formData.get('name'),
              quantity: formData.get('quantity'),
              location: formData.get('location'),
              expiryDate: formData.get('expiryDate'),
            });
            setShowInventoryModal(false);
            event.currentTarget.reset();
            loadData();
          }}
        >
          <Input name="name" placeholder="Ingredient name" required />
          <Input name="quantity" placeholder="Quantity" />
          <Input name="location" placeholder="Location" />
          <Input type="date" name="expiryDate" />
          <Button type="submit" className="w-full">Save Inventory Item</Button>
        </form>
      </Modal>
    </div>
  );
};

export default GroceryList;