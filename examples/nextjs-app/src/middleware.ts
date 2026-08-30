import { auth } from './auth';

export default auth(() => undefined);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
