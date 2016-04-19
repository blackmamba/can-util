if(typeof QUnit === 'undefined') {
	require('steal-qunit');
}

if(typeof document === 'undefined') {
	var createDocument = require('can-simple-dom').createDocument;
	
	require('./document/document')(createDocument());
}

require('./attr/attr-test');
// require('./dispatch/dispatch-test');
// require('./events/delegate/delegate-test');
// require('./events/inserted/inserted-test');
// require('./events/removed/removed-test');
