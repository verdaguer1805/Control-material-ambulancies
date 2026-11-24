import { installSvbSendReminder } from './svb-send-reminder.js?v=280';
// Local photo previews must never navigate to a real submission.
if (!new URLSearchParams(location.search).has('local')) installSvbSendReminder();
