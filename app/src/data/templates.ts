// Starter examples — one click fills the draft with a correctly-structured letter the user then edits.
// They double as "what good looks like." Specifics the writer must replace are shown in [BRACKETS];
// the boilerplate language and structure follow SECNAV M-5216.5. Loading one is undoable.
import { defaultFor } from '../defaultState';
import type { LetterState } from '../types';

export interface Template {
  id: string;
  name: string;
  blurb: string;
  build: () => LetterState;
}

const para = (id: string, text: string, title?: string) => ({ id, text, title, children: [] });

export const TEMPLATES: Template[] = [
  {
    id: 'appreciation',
    name: 'Letter of appreciation',
    blurb: 'Thank a command or member for support — standard letter, SSIC 1650.',
    build: () => ({
      ...defaultFor('standard-letter'),
      ssic: '1650',
      includeSsic: true,
      originatorCode: '[CODE]',
      includeCode: true,
      from: 'Commanding Officer, [Your Command]',
      to: 'Commanding Officer, [Receiving Command]',
      subj: 'APPRECIATION FOR SUPPORT DURING [EVENT OR PERIOD]',
      refs: [],
      encls: [],
      body: [
        para('b1', 'On behalf of [Your Command], I extend my sincere appreciation for the outstanding support your team provided during [event or period].'),
        para('b2', 'The professionalism and dedication of [name/team] directly contributed to [result]. Their effort reflected great credit upon your command.'),
        para('b3', 'Please convey my thanks to all involved. I look forward to continued cooperation between our commands.'),
      ],
      signature: { name: '[LAST NAME]', title: '', authority: 'none' },
    }),
  },
  {
    id: 'request',
    name: 'Request letter',
    blurb: 'Ask another command to take an action — standard letter with a Via.',
    build: () => ({
      ...defaultFor('standard-letter'),
      ssic: '[SSIC]',
      includeSsic: true,
      originatorCode: '[CODE]',
      includeCode: true,
      from: 'Commanding Officer, [Your Command]',
      to: '[Action Addressee]',
      via: [{ id: 'v1', text: '[Via Addressee, if routed]' }],
      subj: 'REQUEST FOR [ACTION OR RESOURCE]',
      refs: [{ id: 'r1', text: '[Authority or related correspondence]' }],
      encls: [{ id: 'e1', text: '[Supporting document]', inDocument: false }],
      body: [
        para('b1', 'Request [specific action] in accordance with reference (a).', 'Request'),
        para('b2', 'The following supports this request:', 'Background', ),
        { id: 'b3', text: '', children: [para('b3a', '[Supporting point one].'), para('b3b', '[Supporting point two].')] },
        para('b4', 'Point of contact is [name, title, phone/email].'),
      ],
      signature: { name: '[LAST NAME]', title: '', authority: 'by-direction' },
    }),
  },
  {
    id: 'mfr',
    name: 'Memorandum for the record',
    blurb: 'Capture a phone call, meeting, or oral agreement — plain paper (Ch 10).',
    build: () => ({
      ...defaultFor('mfr'),
      subj: 'RECORD OF TELEPHONE CONVERSATION WITH [PARTY] ON [SUBJECT]',
      body: [
        para('b1', 'On [date], the undersigned spoke with [name/title/organization] regarding [subject].'),
        para('b2', '[Summarize what was discussed and any decisions or commitments made].'),
        para('b3', 'This memorandum records that conversation for the file.'),
      ],
      signature: { name: '[LAST NAME]', title: '[CODE]', authority: 'none' },
    }),
  },
  {
    id: 'business',
    name: 'Business letter (to a company)',
    blurb: 'Correspond with a firm, agency, or person outside the DoD — Ch 11.',
    build: () => ({
      ...defaultFor('business-letter'),
      ssic: '[SSIC]',
      includeSsic: true,
      subj: '',
      body: [
        para('b1', 'Thank you for your [letter/proposal/inquiry] of [date] regarding [subject].'),
        para('b2', '[State your response, decision, or request in plain, courteous language — business letters use unnumbered paragraphs unless several points need to be itemized].'),
        para('b3', 'If you have any questions, please contact [name] at [phone/email].'),
      ],
      signature: { name: '[Full Name]', title: '[Title]', authority: 'none' },
      business: {
        ...defaultFor('business-letter').business,
        insideAddress: '[Recipient Name]\n[Company / Organization]\n[Street Address]\n[City, State ZIP]',
        salutation: 'Dear [Mr./Ms. Name]:',
      },
    }),
  },
  {
    id: 'congressional',
    name: 'Congressional response',
    blurb: 'Reply to a Member of Congress — business-letter format (Ch 12, fig 12-4).',
    build: () => ({
      ...defaultFor('business-letter'),
      ssic: '[SSIC]',
      includeSsic: true,
      subj: '',
      copyTo: ['The Honorable [Last Name]', 'Ranking Minority Member'],
      body: [
        para('b1', 'Thank you for your letter of [date], concerning [subject]. I am responding on behalf of the Secretary of the Navy.'),
        para('b2', '[Response — address the concern directly and courteously].'),
        para('b3', 'Again, I appreciate you taking the time to share your thoughts on this issue. If I may be of any further assistance, please let me know.'),
      ],
      signature: { name: '[Full Name]', title: '[Title / Position]', authority: 'none' },
      business: {
        ...defaultFor('business-letter').business,
        // Chairman of a committee; for a Senator use "United States Senate" and ZIP 20510 (fig 12-4).
        insideAddress:
          'The Honorable [Full Name]\nChairman\nCommittee on [Name]\nU.S. House of Representatives\nWashington, DC 20515',
        salutation: 'Dear Mr. [or Madam] Chairman:',
      },
    }),
  },
  {
    id: 'flag',
    name: 'Flag stationery (informal)',
    blurb: 'Personal note for a flag officer’s pre-printed flag stationery (Ch 12, figs 12-7/12-8).',
    build: () => ({
      ...defaultFor('business-letter'),
      includeSsic: false,
      includeCode: false,
      subj: '',
      // Flag stationery is pre-printed with the officer’s personal flag + title; the flag is physical,
      // so render just the centered navy title (the letterhead line) and type the note beneath it.
      letterhead: {
        ...defaultFor('business-letter').letterhead,
        mode: 'on',
        seal: 'none',
        line1: 'CHIEF OF NAVAL OPERATIONS',
        activityName: '',
        addressLine: '',
        cityStateZip: '',
      },
      body: [
        para('b1', 'Thank you for [hosting the event / speaking on my behalf] yesterday in my absence. I trust it went well.'),
        para('b2', 'Your [remarks / support] received many positive compliments, and I appreciate your valuable time.'),
        para('b3', 'I appreciate your support and wish you all the best.'),
      ],
      signature: { name: '[Full Name]', title: '[Rank], U.S. Navy', authority: 'none' },
      business: {
        ...defaultFor('business-letter').business,
        insideAddress: '[Rank Full Name, USN]\n[Title]\n[Street Address]\n[City, State ZIP]',
        salutation: 'Dear [Admiral Name]:',
        complimentaryClose: 'Sincerely,', // informal notes may use "Warm Regards," etc. (fig 12-7)
      },
    }),
  },
  {
    id: 'interim',
    name: 'Interim reply',
    blurb: 'Acknowledge incoming correspondence you can’t yet answer fully (Ch 12, fig 12-2).',
    build: () => ({
      ...defaultFor('business-letter'),
      ssic: '[SSIC]',
      includeSsic: true,
      subj: '',
      body: [
        para('b1', 'This is to acknowledge your recent letter concerning [subject]. Your letter has been referred to [lead office], and I am responding on behalf of [name].'),
        para('b2', 'We are gathering the information necessary to provide a substantive response and will reply further upon completion of our review. You can expect a final response by [date].'),
        para('b3', 'In the interim, if you require further assistance or need to provide additional information, you may contact [name, phone number], who is coordinating the response.'),
      ],
      signature: { name: '[Full Name]', title: '[Title / Position]', authority: 'none' },
      business: {
        ...defaultFor('business-letter').business,
        insideAddress: 'Mr. [or Ms.] [Full Name]\n[Street Address]\n[City, State ZIP]',
        salutation: 'Dear Mr. [or Ms.] [Last Name]:',
      },
    }),
  },
];
