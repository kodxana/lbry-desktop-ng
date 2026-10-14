# Forms and dates

This batch updates the wallet send form and the date/duration utilities while
retaining React 16.14, the desktop theme and the existing SDK interface.

| Package | Previous lock | Updated |
| --- | --- | --- |
| `formik` | 0.10.5 | 2.4.9 |
| `react-datetime-picker` | 3.5.0 | 7.1.0 |
| `react-calendar` | 3.7.0 (transitive) | 6.0.1 (direct) |
| `moment` | 2.29.4 | 2.31.0 |
| `parse-duration` | 1.0.2 | 2.1.9 |
| `humanize-duration` | 3.27.2 | 3.35.0 |

## Compatibility

Formik now uses function children instead of its deprecated render prop. The
send draft remains owned by the send page, and the exact amount string reaches
the confirmation dialog unchanged. Opening that dialog finishes Formik's
synchronous submission cycle so cancelling and retrying still work. The same
validation now guards both the button and submission; an empty/invalid recipient,
nonpositive or unaffordable amount, unknown balance, or in-flight send cannot
open confirmation through a form submission.

The date picker no longer loads CSS itself. Its styles and the calendar stylesheet
are explicitly loaded before the desktop overrides. The calendar is declared as
a direct dependency because the app imports its stylesheet. Calendar styling now
uses `calendarProps.className`; the obsolete `calendarClassName` prop is ignored by
the new version. Date inputs retain accessible labels, local-time entry, Unix
seconds in the publish draft, the future-date limit and reset/default actions.

The new picker/calendar stack and duration parser ship ESM. Webpack supports
their exports; React 16's extensionless JSX-runtime import needs an exact alias
to its shipped `jsx-runtime.js`, which is shared by production and development.
Moment's explicit locale loading and the timeout parser's seconds output remain
unchanged. This is not a replacement of Moment or a change to date storage.

## Validation

`build/tests/formsAndDates.jsx` runs the real components in Electron with the
production styles. It covers send validation, confirmation/cancellation/retry,
address and content recipients, exact amount strings, leap-day and local-time
editing, calendar selection, date reset/default, future dates, timed/permanent
blocks, duration limits, localized dates and media duration formatting.

Transaction and moderation callbacks are controlled fixtures. External requests
are blocked and no personal wallet or funds are used. Existing wallet ZIP,
encryption/restore, native password migration/restart, updater consent/shutdown,
sandbox and package/startup suites remain required on Windows and Linux, along
with the hosted Windows installed-upgrade workflow.

Automated fixtures do not establish funded-transaction acceptance, screen-reader
behavior, or every locale and timezone. React and the remaining older UI packages
still need later migration work.

References: [Formik 2 migration](https://formik.org/docs/migrating-v2),
[Formik submission lifecycle](https://formik.org/docs/guides/form-submission),
[date picker 5](https://github.com/wojtekmaj/react-datetime-picker/releases/tag/v5.0.0),
[date picker 6](https://github.com/wojtekmaj/react-datetime-picker/releases/tag/v6.0.0),
[date picker 7](https://github.com/wojtekmaj/react-datetime-picker/releases/tag/v7.0.0),
[duration parser](https://github.com/jkroso/parse-duration).
