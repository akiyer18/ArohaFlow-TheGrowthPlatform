import { supabase } from '../config/supabase';

/**
 * Grocery Management Service
 * Handles grocery items, inventory, and shopping lists
 */

// Get all grocery items
export const getGroceryItems = async (filters = {}) => {
  try {
    let query = supabase
      .from('grocery_items')
      .select('*')
      .order('due_date', { ascending: true });

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.purchased !== undefined) {
      query = query.eq('is_purchased', filters.purchased);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.addedFromMealPlan !== undefined) {
      query = query.eq('added_from_meal_plan', filters.addedFromMealPlan);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching grocery items:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getGroceryItems:', error);
    throw error;
  }
};

// Create a new grocery item
export const createGroceryItem = async (itemData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('grocery_items')
      .insert([{
        user_id: user.id,
        name: itemData.name,
        category: itemData.category || 'Other',
        quantity: itemData.quantity || '1',
        unit: itemData.unit || null,
        notes: itemData.notes || null,
        frequency: itemData.frequency || 'weekly',
        priority: itemData.priority || 3,
        estimated_price: itemData.estimatedPrice || null,
        store_section: itemData.storeSection || null,
        due_date: itemData.dueDate || null,
        added_from_meal_plan: itemData.addedFromMealPlan || false
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating grocery item:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createGroceryItem:', error);
    throw error;
  }
};

// Update a grocery item
export const updateGroceryItem = async (itemId, updates) => {
  try {
    const updateData = {
      name: updates.name,
      category: updates.category,
      quantity: updates.quantity,
      unit: updates.unit,
      notes: updates.notes,
      frequency: updates.frequency,
      priority: updates.priority,
      estimated_price: updates.estimatedPrice,
      store_section: updates.storeSection,
      due_date: updates.dueDate,
      is_in_inventory: updates.isInInventory,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('grocery_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating grocery item:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateGroceryItem:', error);
    throw error;
  }
};

// Mark grocery item as purchased
export const markGroceryItemPurchased = async (itemId, isPurchased = true) => {
  try {
    let updateData = {
      is_purchased: isPurchased,
      updated_at: new Date().toISOString()
    };

    if (isPurchased) {
      // First get the current purchase count
      const { data: currentItem, error: fetchError } = await supabase
        .from('grocery_items')
        .select('purchase_count')
        .eq('id', itemId)
        .single();

      if (fetchError) {
        console.error('Error fetching current item:', fetchError);
        throw fetchError;
      }

      updateData.last_purchased = new Date().toISOString().split('T')[0];
      updateData.purchase_count = (currentItem.purchase_count || 0) + 1;
    }

    const { data, error } = await supabase
      .from('grocery_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error marking grocery item as purchased:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in markGroceryItemPurchased:', error);
    throw error;
  }
};

// Delete a grocery item
export const deleteGroceryItem = async (itemId) => {
  try {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting grocery item:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteGroceryItem:', error);
    throw error;
  }
};

// Get shopping list (unpurchased items)
export const getShoppingList = async () => {
  try {
    return await getGroceryItems({ purchased: false });
  } catch (error) {
    console.error('Error in getShoppingList:', error);
    throw error;
  }
};

// Get grocery items by category
export const getGroceryItemsByCategory = async () => {
  try {
    const items = await getGroceryItems();
    
    const categories = items.reduce((acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});

    return categories;
  } catch (error) {
    console.error('Error in getGroceryItemsByCategory:', error);
    throw error;
  }
};

// Get overdue grocery items
export const getOverdueGroceryItems = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('grocery_items')
      .select('*')
      .eq('is_purchased', false)
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching overdue grocery items:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOverdueGroceryItems:', error);
    throw error;
  }
};

// Add multiple grocery items from meal plan
export const addGroceryItemsFromMealPlan = async (ingredients) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    // Only add ingredients not already in grocery list or current inventory
    const existingItems = await getGroceryItems();
    const inventoryItems = await getUserInventory();
    const existingNames = new Set([
      ...existingItems.map(item => item.name.toLowerCase()),
      ...inventoryItems.map(item => item.ingredient_name.toLowerCase())
    ]);

    const newIngredients = ingredients.filter(ingredient =>
      !existingNames.has((ingredient.name || '').toLowerCase())
    );

    if (newIngredients.length === 0) {
      return [];
    }

    const groceryItems = newIngredients.map(ingredient => ({
      user_id: user.id,
      name: ingredient.name,
      category: categorizeIngredient(ingredient.name),
      quantity: ingredient.quantity || '1',
      added_from_meal_plan: true,
      due_date: ingredient.dueDate || null
    }));

    const { data, error } = await supabase
      .from('grocery_items')
      .insert(groceryItems)
      .select();

    if (error) {
      console.error('Error adding grocery items from meal plan:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in addGroceryItemsFromMealPlan:', error);
    throw error;
  }
};

// User Inventory Management

// Get user inventory
export const getUserInventory = async () => {
  try {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .order('ingredient_name', { ascending: true });

    if (error) {
      console.error('Error fetching user inventory:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserInventory:', error);
    throw error;
  }
};

// Add item to inventory
export const addToInventory = async (inventoryData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_inventory')
      .upsert([{
        user_id: user.id,
        ingredient_name: inventoryData.name,
        quantity: inventoryData.quantity || null,
        unit: inventoryData.unit || null,
        expiry_date: inventoryData.expiryDate || null,
        location: inventoryData.location || null,
        notes: inventoryData.notes || null
      }], {
        onConflict: 'user_id,ingredient_name'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to inventory:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in addToInventory:', error);
    throw error;
  }
};

// Remove item from inventory
export const removeFromInventory = async (ingredientName) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_inventory')
      .delete()
      .eq('user_id', user.id)
      .eq('ingredient_name', ingredientName);

    if (error) {
      console.error('Error removing from inventory:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in removeFromInventory:', error);
    throw error;
  }
};

// Shopping Lists Management

// Create a shopping list
export const createShoppingList = async (listData) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert([{
        user_id: user.id,
        name: listData.name,
        store_name: listData.storeName || null,
        total_estimated_cost: listData.estimatedCost || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating shopping list:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createShoppingList:', error);
    throw error;
  }
};

// Get shopping lists
export const getShoppingLists = async () => {
  try {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shopping lists:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getShoppingLists:', error);
    throw error;
  }
};

// Utility functions

// Categorize ingredient automatically
const categorizeIngredient = (ingredientName) => {
  const ingredient = ingredientName.toLowerCase();
  
  const categories = {
    'Produce': ['tomato', 'onion', 'garlic', 'bell pepper', 'cucumber', 'avocado', 'lime', 'lemon', 'parsley', 'cilantro', 'spinach', 'lettuce', 'carrot', 'potato', 'broccoli'],
    'Dairy': ['milk', 'butter', 'cheese', 'yogurt', 'cream', 'eggs'],
    'Meat': ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb'],
    'Pantry': ['rice', 'pasta', 'bread', 'flour', 'sugar', 'salt', 'pepper', 'olive oil', 'soy sauce', 'vinegar'],
    'Frozen': ['frozen', 'ice cream'],
    'Bakery': ['bread', 'bagel', 'muffin']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => ingredient.includes(keyword))) {
      return category;
    }
  }

  return 'Other';
};

// Get grocery statistics
export const getGroceryStatistics = async () => {
  try {
    const items = await getGroceryItems();
    const purchased = items.filter(item => item.is_purchased);
    const unpurchased = items.filter(item => !item.is_purchased);
    const overdue = await getOverdueGroceryItems();

    const stats = {
      totalItems: items.length,
      purchasedItems: purchased.length,
      unpurchasedItems: unpurchased.length,
      overdueItems: overdue.length,
      purchaseRate: items.length > 0 ? Math.round((purchased.length / items.length) * 100) : 0,
      categoryBreakdown: items.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {}),
      totalEstimatedCost: unpurchased.reduce((sum, item) => sum + (parseFloat(item.estimated_price) || 0), 0),
      fromMealPlan: items.filter(item => item.added_from_meal_plan).length
    };

    return stats;
  } catch (error) {
    console.error('Error in getGroceryStatistics:', error);
    throw error;
  }
}; 