// Maps a raw Postgres/Supabase error to a user-safe message, so server actions
// never surface internal DB text (constraint/column names, SQL state) to the
// browser. Known SQLSTATE codes get a helpful message; everything else falls back
// to a generic one. Our own RPCs' RAISE EXCEPTION messages (P0001) are intentional
// business text and are passed through.
export function friendlyDbError(err: any, fallback = 'Something went wrong. Please try again.'): string {
  const code: string | undefined = err?.code;
  if (code === 'P0001' && typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  switch (code) {
    case '23505':
      return 'A record with the same unique value already exists.';
    case '23503':
      return 'This links to a record that no longer exists.';
    case '23514':
      return 'Some values are not allowed — please check the form and try again.';
    case '23502':
      return 'A required field is missing.';
    case '42501':
      return 'You do not have permission to do that.';
    default:
      return fallback;
  }
}
