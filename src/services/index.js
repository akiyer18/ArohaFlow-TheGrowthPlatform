/**
 * Services Index
 * Central export file for all backend services
 */

// Export all account services
export * from './accountsService';

// Export all transaction services
export * from './transactionsService';

// Export all budget services
export * from './budgetService';

// Export all planning services
export * from './planningService';

// Export all reminder services
export * from './remindersService';

// Export all task services
export * from './tasksService';

// Export all recipe services
export * from './recipesService';

// Export all meal planning services
export * from './mealPlanService';

// Export all grocery services
export * from './groceryService';

// Export all habit services
export * from './habitService';

// Export flow / momentum services (legacy flow score)
export * from './flowService';

// Momentum Engine (effort 0-100, momentum 0-1000)
export * from './momentumEngineService';

// Export calendar events service
export * from './calendarEventsService';

// Journal (minimal-friction daily check-in)
export * from './journalService';

// Knowledge Expansion (structured learning journal)
export * from './knowledgeService';

// Export active data layer and selected source
export { supabase, activeDataSource, isLocalMode } from '../config/supabase';
export { dataClient, dataService, DATA_SOURCE } from './data/DataService';