import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JWT guard. Routes are protected by default
 * ("secure by default"), so forgetting a decorator fails closed, not open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
