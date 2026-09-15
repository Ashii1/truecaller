import { ContactItem } from '../types';

/**
 * Authentic Device Contacts Store
 * Strictly initialized to empty array. Contacts are populated ONLY from the physical device's
 * ContactsContract.CommonDataKinds.Phone API or explicit user additions.
 */
export const INITIAL_CONTACTS: ContactItem[] = [];
