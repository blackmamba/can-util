// # can/util/attr.js
// Central location for attribute changing to occur, used to trigger an
// `attributes` event on elements. This enables the user to do (jQuery example): `$(el).bind("attributes", function(ev) { ... })` where `ev` contains `attributeName` and `oldValue`.
var setImmediate = require("../../js/set-immediate/set-immediate");
var getDocument = require("../document/document");
var global = require("../../js/global/global")();
var isOfGlobalDocument = require("../is-of-global-document/is-of-global-document");
var isArray = require("../../js/is-array/is-array");
var setData = require("../data/data");
var domDispatch = require("../dispatch/dispatch");
var MUTATION_OBSERVER = require("../mutation-observer/mutation-observer");


require("../events/attributes/attributes");


// Acts as a polyfill for setImmediate which only works in IE 10+. Needed to make
// the triggering of `attributes` event async.
var formElements = {"input": true, "textarea": true, "select": true},
	hasProperty = function(el,attrName){
		return (attrName in el) || (getDocument() && formElements[el.nodeName.toLowerCase()]);
	},
	attr = {
		/**
		 * @property {Object.<String,(String|Boolean|function)>} can/util/dom/attr/attr.map map
		 * @parent can-util/dom/attr
		 * @hide
		 *
		 *
		 * A mapping of
		 * special attributes to their JS property. For example:
		 *
		 *     "class" : "className"
		 *
		 * means get or set `element.className`. And:
		 *
		 *      "checked" : true
		 *
		 * means set `element.checked = true`.
		 *
		 *
		 * If the attribute name is not found, it's assumed to use
		 * `element.getAttribute` and `element.setAttribute`.
		 */
		map: {
			"class": function(el, val) {
				val = val || '';

				if(el.namespaceURI === 'http://www.w3.org/2000/svg') {
					el.setAttribute('class', '' + val);
				}
				else {
					el.className = val;
				}

				return val;
			},
			"value": "value",
			"innertext": "innerText",
			"innerhtml": "innerHTML",
			"textcontent": "textContent",
			"for": "htmlFor",
			"checked": true,
			"disabled": true,
			"readonly": function (el, val) {
				el.readOnly = true;
				return val;
			},
			"required": true,
			// For the `src` attribute we are using a setter function to prevent values such as an empty string or null from being set.
			// An `img` tag attempts to fetch the `src` when it is set, so we need to prevent that from happening by removing the attribute instead.
			src: function (el, val) {
				if (val == null || val === "") {
					el.removeAttribute("src");
					return null;
				} else {
					el.setAttribute("src", val);
					return val;
				}
			},
			style: (function () {
				var el = global.document && getDocument().createElement('div');
				if ( el && el.style && ("cssText" in el.style) ) {
					return function (el, val) {
						return el.style.cssText = (val || "");
					};
				} else {
					return function (el, val) {
						return el.setAttribute("style", val);
					};
				}
			})()
		},
		// These are elements whos default value we should set.
		defaultValue: ["input", "textarea"],
		setAttrOrProp: function(el, attrName, val){
			attrName = attrName.toLowerCase();
			var prop = attr.map[attrName];
			if(prop === true && !val) {
				this.remove(el, attrName);
			} else {
				this.set(el, attrName, val);
			}
		},
		setSelectValue: function(el, val) {
			// jshint eqeqeq: false
			if(val != null) {
				var options = el.getElementsByTagName('option');
				for(var i  = 0; i < options.length; i++) {
					if(val == options[i].value) {
						options[i].selected = true;
						return;
					}
				}
			}

			el.selectedIndex = -1;
		},
		// ## attr.set
		// Set the value an attribute on an element.
		set: function (el, attrName, val) {
			var usingMutationObserver = isOfGlobalDocument(el) && MUTATION_OBSERVER();
			attrName = attrName.toLowerCase();
			var oldValue;
			// In order to later trigger an event we need to compare the new value to the old value,
			// so here we go ahead and retrieve the old value for browsers that don't have native MutationObservers.
			if (!usingMutationObserver) {
				oldValue = attr.get(el, attrName);
			}

			var prop = attr.map[attrName],
				newValue;

			// Using the property of `attr.map`, go through and check if the property is a function, and if so call it.
			// Then check if the property is `true`, and if so set the value to `true`, also making sure
			// to set `defaultChecked` to `true` for elements of `attr.defaultValue`. We always set the value to true
			// because for these boolean properties, setting them to false would be the same as removing the attribute.
			//
			// For all other attributes use `setAttribute` to set the new value.
			if (typeof prop === "function") {
				newValue = prop(el, val);
			} else if (prop === true && hasProperty(el, attrName)) {
				newValue = el[attrName] = true;

				if (attrName === "checked" && el.type === "radio") {
					if (isArray((el.nodeName+"").toLowerCase(), attr.defaultValue) >= 0) {
						el.defaultChecked = true;
					}
				}

			} else if (typeof prop === "string" && hasProperty(el, prop)) {
				newValue = val;
				// https://github.com/canjs/canjs/issues/356
				// But still needs to be set for <option>fields
				if (el[prop] !== val || el.nodeName.toUpperCase() === 'OPTION') {
					el[prop] = val;
				}
				if (prop === "value" && attr.defaultValue.indexOf((el.nodeName+"").toLowerCase()) >= 0) {
					el.defaultValue = val;
				}
			} else {
				attr.setAttribute(el, attrName, val);
			}

			// Now that the value has been set, for browsers without MutationObservers, check to see that value has changed and if so trigger the "attributes" event on the element.
			if (!usingMutationObserver && newValue !== oldValue) {
				attr.trigger(el, attrName, oldValue);
			}
		},
		setAttribute: (function(){
			var doc = getDocument();
			if(doc && document.createAttribute) {
				try {
					doc.createAttribute("{}");
				} catch(e) {
					var invalidNodes = {},
						attributeDummy = document.createElement('div');

					return function(el, attrName, val){
						var first = attrName.charAt(0),
							cachedNode,
							node;
						if((first === "{" || first === "(" || first === "*") && el.setAttributeNode) {
							cachedNode = invalidNodes[attrName];
							if(!cachedNode) {
								attributeDummy.innerHTML = '<div ' + attrName + '=""></div>';
								cachedNode = invalidNodes[attrName] = attributeDummy.childNodes[0].attributes[0];
							}
							node = cachedNode.cloneNode();
							node.value = val;
							el.setAttributeNode(node);
						} else {
							el.setAttribute(attrName, val);
						}
					};
				}
			}
			return function(el, attrName, val){
				el.setAttribute(attrName, val);
			};

		})(),
		// ## attr.trigger
		// Used to trigger an "attributes" event on an element. Checks to make sure that someone is listening for the event and then queues a function to be called asynchronously using `setImmediate.
		trigger: function (el, attrName, oldValue) {
			if (setData.get.call(el, "canHasAttributesBindings")) {
				attrName = attrName.toLowerCase();
				return setImmediate(function () {
					domDispatch.call(el, {
						type: "attributes",
						attributeName: attrName,
						target: el,
						oldValue: oldValue,
						bubbles: false
					}, []);
				});
			}
		},
		// ## attr.get
		// Gets the value of an attribute. First checks to see if the property is a string on `attr.map` and if so returns the value from the element's property. Otherwise uses `getAttribute` to retrieve the value.
		get: function (el, attrName) {
			attrName = attrName.toLowerCase();
			var prop = attr.map[attrName];
			if(typeof prop === "string" && hasProperty(el, prop) ) {
				return el[prop];
			} else if(prop === true && hasProperty(el, attrName) ) {
				return el[attrName];
			}

			return el.getAttribute(attrName);
		},
		// ## attr.remove
		// Removes an attribute from an element. Works by using the `attr.map` to see if the attribute is a special type of property. If the property is a function then the fuction is called with `undefined` as the value. If the property is `true` then the attribute is set to false. If the property is a string then the attribute is set to an empty string. Otherwise `removeAttribute` is used.
		//
		// If the attribute previously had a value and the browser doesn't support MutationObservers we then trigger an "attributes" event.
		remove: function (el, attrName) {
			attrName = attrName.toLowerCase();
			var oldValue;
			if (!MUTATION_OBSERVER()) {
				oldValue = attr.get(el, attrName);
			}

			var setter = attr.map[attrName];
			if (typeof setter === "function") {
				setter(el, undefined);
			}
			if (setter === true && hasProperty(el, attrName) ) {
				el[attrName] = false;
			} else if (typeof setter === "string" && hasProperty(el, setter) ) {
				el[setter] = "";
			} else {
				el.removeAttribute(attrName);
			}
			if (!MUTATION_OBSERVER() && oldValue != null) {
				attr.trigger(el, attrName, oldValue);
			}

		},
		// ## attr.has
		// Checks if an element contains an attribute.
		// For browsers that support `hasAttribute`, creates a function that calls hasAttribute, otherwise creates a function that uses `getAttribute` to check that the attribute is not null.
		has: (function () {
			var el = getDocument() && document.createElement('div');
			if (el && el.hasAttribute) {
				return function (el, name) {
					return el.hasAttribute(name);
				};
			} else {
				return function (el, name) {
					return el.getAttribute(name) !== null;
				};
			}
		})()
	};

module.exports = exports = attr;
