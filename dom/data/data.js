var isEmptyObject = require("../../js/is-empty-object/is-empty-object");
var data = {};
var expando = 'can'+new Date();
var uuid = 0;
var setData = function(name, value) {
	var id = this[expando] || (this[expando] = ++uuid),
		store = data[id] || (data[id] = {});
	if (name !== undefined) {
		store[name] = value;
	}
	return store;
};

module.exports = {
	getCid: function(){
		return this[expando];
	},
	cid: function(){
		return this[expando] || (this[expando] = ++uuid);
	},
	expando: expando,
	clean: function(prop) {
		var id = this[expando];
		delete data[id][prop];
		if(isEmptyObject(data[id])) {
			delete data[id];
		}
	},
	get: function(name){
		var id = this[expando],
			store = id && data[id];
		return name === undefined ? store || setData(this) : store && store[name];
	},
	set: setData
};
