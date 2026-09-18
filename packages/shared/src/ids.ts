import { v7 as uuidv7, validate, version } from 'uuid';

/**
 * New entity ID: a time-ordered UUIDv7. Browsers generate IDs for optimistic creates, so a
 * retried request can never create a duplicate. IDs never change, even when synced elsewhere.
 */
export function newId(): string {
  return uuidv7();
}

export function isId(value: string): boolean {
  return validate(value) && version(value) === 7;
}
