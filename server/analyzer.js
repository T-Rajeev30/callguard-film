// VaaniLens signal extractor v0 — transparent, rule-based, works on Prisma output in
// Latin (code-mix / transliterated) or Devanagari script. Every signal points to the words that triggered it.
'use strict';

const RULES = {
  commitStrong: ['pakka', 'zaroor', 'jaroor', 'definitely', 'sure', 'confirm', 'पक्का', 'ज़रूर', 'जरूर', 'pakka se'],
  commitWeak: ['try karunga', 'try karungi', 'koshish', 'dekhta hoon', 'dekhti hoon', 'shayad', 'maybe', 'dekhenge', 'कोशिश', 'देखता हूँ', 'देखता हूं', 'शायद'],
  commit: ['kar dunga', 'kar dungi', 'kar denge', 'de dunga', 'de dungi', 'de denge', 'bhej dunga', 'bhej dungi', 'jama kar', 'pay kar', 'payment kar',
    'will pay', 'i will pay', "i'll pay", 'kar doonga', 'कर दूँगा', 'कर दूंगा', 'कर दूँगी', 'कर दूंगी', 'दे दूँगा', 'दे दूंगा', 'भेज दूँगा', 'भर दूँगा', 'जमा कर'],
  dispute: ['already paid', 'pehle hi', 'pehle hee', 'de diya', 'kar diya', 'bhar diya', 'paid last', 'पहले ही', 'दे दिया', 'कर दिया', 'भर दिया'],
  confusion: ['samajh nahi', 'samjha nahi', 'kya matlab', 'matlab kya', 'kitna hai', 'kitna', 'kaun sa', "don't understand", 'not clear',
    'समझ नहीं', 'मतलब', 'कितना', 'कितने'],
};

const DAYS = {
  'aaj': 0, 'today': 0, 'आज': 0,
  'kal': 1, 'tomorrow': 1, 'कल': 1,
  'parso': 2, 'parson': 2, 'परसों': 2, 'परसो': 2,
  'agle hafte': 7, 'next week': 7, 'अगले हफ्ते': 7, 'अगले हफ़्ते': 7,
  'mahine ke end': 'eom', 'month end': 'eom', 'end of month': 'eom', 'महीने के अंत': 'eom',
};
const WEEKDAYS = { monday: 1, somvar: 1, 'सोमवार': 1, tuesday: 2, mangalvar: 2, 'मंगलवार': 2, wednesday: 3, budhvar: 3, 'बुधवार': 3,
  thursday: 4, guruvar: 4, 'गुरुवार': 4, friday: 5, shukravar: 5, 'शुक्रवार': 5, saturday: 6, shanivar: 6, 'शनिवार': 6, sunday: 0, ravivar: 0, 'रविवार': 0 };

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[.,!?।"“”]/g, ' ').replace(/\s+/g, ' ')} `;
const has = (t, w) => t.includes(` ${w.toLowerCase()} `) || (/[^\x00-\x7F]/.test(w) && t.includes(w));
const found = (t, list) => list.filter((w) => has(t, w));
const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function analyze(transcript, now = new Date()) {
  const t = norm(transcript);
  const signals = [];

  // deadline
  let deadline = null;
  for (const [w, off] of Object.entries(DAYS)) {
    if (!has(t, w)) continue;
    const d = new Date(now);
    if (off === 'eom') d.setMonth(d.getMonth() + 1, 0); else d.setDate(d.getDate() + off);
    deadline = { evidence: w, date: d, label: off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : off === 7 ? 'Next week' : off === 'eom' ? 'Month end' : `In ${off} days` };
    break;
  }
  if (!deadline) for (const [w, wd] of Object.entries(WEEKDAYS)) {
    if (!has(t, w)) continue;
    const d = new Date(now); d.setDate(d.getDate() + (((wd - d.getDay()) + 7) % 7 || 7));
    deadline = { evidence: w, date: d, label: w[0].toUpperCase() + w.slice(1) };
    break;
  }

  // amount
  const amt = (transcript || '').match(/(₹|rs\.?|inr)\s?([\d,]+)|([\d,]{3,})\s?(rupaye|rupees|rupay|रुपये|रुपए)/i);
  const amount = amt ? `₹${(amt[2] || amt[3]).replace(/^,|,$/g, '')}` : null;

  const strong = found(t, RULES.commitStrong), weak = found(t, RULES.commitWeak), commit = found(t, RULES.commit);
  const dispute = found(t, RULES.dispute), confusion = found(t, RULES.confusion);

  if (dispute.length) {
    signals.push({ type: 'DISPUTE', value: 'Says already paid', evidence: dispute, color: 'cream' });
  } else if (commit.length || strong.length) {
    const strength = weak.length ? 'Low' : strong.length ? 'High' : 'Medium';
    signals.push({ type: 'COMMITMENT', value: amount ? `Will pay ${amount}` : 'Will pay', strength, evidence: [...strong, ...commit, ...weak], color: 'lime' });
  }
  if (deadline) signals.push({ type: 'DEADLINE', value: `${deadline.label} · ${fmt(deadline.date)}`, evidence: [deadline.evidence], color: 'cream' });
  if (confusion.length) signals.push({ type: 'CONFUSION', value: 'Customer needs an explanation', evidence: confusion, color: 'violet' });

  // follow-up recommendation + the reminder Timbre will speak (Hindi, Devanagari for natural prosody)
  let followUp, reply;
  if (dispute.length) {
    followUp = 'Pause reminders · verify payment in ledger';
    reply = 'नमस्ते जी, आपकी जानकारी के लिए धन्यवाद। हम आपका भुगतान जाँच कर आपको जल्द ही बताएँगे।';
  } else if (confusion.length) {
    followUp = 'Call back · explain EMI in the customer\'s language';
    reply = 'नमस्ते जी, आपकी ई एम आई हर महीने की तय किस्त है। कोई भी सवाल हो तो हमें ज़रूर बताइए।';
  } else if (commit.length || strong.length) {
    const when = deadline ? new Date(deadline.date) : new Date(now.getTime() + 86400000);
    if (!deadline || deadline.label !== 'Today') when.setDate(when.getDate() - (deadline ? 0 : 0));
    followUp = deadline ? `Voice reminder · ${fmt(deadline.date)}, 10 AM · Hindi` : 'Ask for a specific date';
    reply = deadline
      ? `नमस्ते जी, ${deadline.label === 'Tomorrow' ? 'कल' : deadline.label === 'Today' ? 'आज' : 'तय तारीख़'} के पेमेंट के लिए एक छोटा सा रिमाइंडर। धन्यवाद।`
      : 'नमस्ते जी, पेमेंट की तारीख़ बताने के लिए धन्यवाद। कृपया एक पक्की तारीख़ बताइए।';
    if (weak.length) followUp += ' · low confidence: confirm a time';
  } else {
    followUp = 'No commitment detected · schedule a callback';
    reply = 'नमस्ते जी, आपसे बात करके अच्छा लगा। हम आपको जल्द ही दोबारा कॉल करेंगे।';
  }
  signals.push({ type: 'FOLLOW-UP', value: followUp, evidence: [], color: 'violet' });

  // code-mix estimate (share of Latin vs Devanagari tokens)
  const toks = String(transcript || '').split(/\s+/).filter(Boolean);
  const deva = toks.filter((w) => /[ऀ-ॿ]/.test(w)).length;
  const mix = toks.length ? { devanagari: deva, latin: toks.length - deva } : { devanagari: 0, latin: 0 };

  return { signals, reply, amount, mix };
}

module.exports = { analyze };
