import { APP_CONFIG, isLocalDataSource } from '../../config/appConfig';
import { SupabaseService } from './SupabaseService';
import { LocalService } from './LocalService';

// Environment switching happens here. Flip VITE_DATA_SOURCE only.
const serviceImplementation = isLocalDataSource ? new LocalService() : new SupabaseService();

export const dataService = serviceImplementation;
export const dataClient = serviceImplementation.getClient();
export const DATA_SOURCE = APP_CONFIG.DATA_SOURCE;

export const getUser = () => dataService.getUser();
export const login = (identifier, password) => dataService.login(identifier, password);
export const register = (identifier, password, metadata) =>
  dataService.register(identifier, password, metadata);
export const logout = () => dataService.logout();
export const fetchData = (table, applyQuery) => dataService.fetchData(table, applyQuery);
export const saveData = (table, operation, payload, applyQuery) =>
  dataService.saveData(table, operation, payload, applyQuery);
