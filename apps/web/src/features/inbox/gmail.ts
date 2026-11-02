/**
 * Gmail links used by the Inbox.
 *
 * gmailComposeUrl opens the normal Gmail inbox with the small "New Message" window on top (same as pressing Compose).
 * gmailInboxUrl is the plain inbox with no window.
 *
 * Gmail only pre-fills the recipient, subject and text in its full-page composer (?view=cm / ?tf=cm), not in this
 * window, so the Inbox copies the address or reply to the clipboard when these links are used.
 */
export const gmailInboxUrl = "https://mail.google.com/mail/u/0/#inbox";

/** Inbox with an empty New Message window open. Gmail cannot pre-fill this window from a link, so callers copy the address. */
export const gmailComposeUrl = "https://mail.google.com/mail/u/0/?tab=rm&ogbl#inbox?compose=new";

/**
 * Gmail's inbox already searched for one person: every email from or to this address, so only their conversation shows
 * instead of the whole inbox.
 */
export const gmailSearchUrl = (email: string) =>
  `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${email} OR to:${email}`)}`;
