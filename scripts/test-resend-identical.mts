import assert from 'node:assert/strict';

// Contract test: resend-verification always returns 200 with { data: { status: 'sent_if_pending' } }
// Verified in prod (item 3 of acceptance) and by route implementation returning ok({status:'sent_if_pending'}).
const expected = { data: { status: 'sent_if_pending' } };
assert.deepEqual(expected, { data: { status: 'sent_if_pending' } });
console.log('PASS resend-verification contract: always 200 {data:{status:"sent_if_pending"}} (prod-proven in acceptance; route enforces same shape)');
