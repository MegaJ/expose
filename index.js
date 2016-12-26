/**
   ES 6 only.
   This module helps expose javascript properties of an object across its entire prototype chain. 

   Use cases:
   All symbols and nonenumerable/inherited properties become enumerable in the returned objects, so you don't have to roll out your own logic
   to expose everything.

   Perhaps useful when debugging, for quick lookups for object methods in a REPL, or reasoning about an object's inheritance history.
   Unlike util.inspect(), you get objects and arrays returned, not strings. This allows you to set up mocks for real objects.

**/

//'use strict';
const {Transform} = require('stream');
const util = require('util');

const supportedOptions = {
	// for stream()
	method: true, 
	verbose: true,
	customInspect: true,
	objectMode: true, //but really, we force the stream into object mode, ignore user option
	// for all other functions
	keepValues: true,
	keepSymbols: true,
	regexp: true
}

function setOptionsObj(from, to) {
	({
		method = "allKeysFlat",
		objectMode: to.objectMode = true,
		verbose: to.verbose = false,
		customInspect: to.customInspect = false,
		keepValues: to.keepValues = false,
		keepSymbols: to.keepSymbols = false,
		//regexp: regexp = false, // can have trailing comma, which is nice
	} = from)
	to.exposeMethod = expose[method] || expose.allKeysFlat;
	return to;
}


const ExposeStream  = function(options) {
	if (!(this instanceof ExposeStream)) {
		return new ExposeStream(options);
	}
	
	//options = options || {};
	if (options.verbose) warnUser(options);
	setOptionsObj(options, this.opt = {});
	
	Transform.call(this, this.opt);
}

ExposeStream.prototype._transform = function(obj, enc, cb) {
	const exposedObj = this.opt.exposeMethod(obj, this.opt);
	if (this.opt.verbose) {
		console.log("");
		console.log(util.inspect(exposedObj, {customInspect: this.opt.customInspect})); //careful about 'this' references here
		console.log("");
	}

	cb(null, exposedObj);
}
util.inherits(ExposeStream, Transform);

const expose = {
	/** I'm taken to one-liners nowadays. Not sure if this is hacks, but guards against TypeErrors when destructuring.
		Still provides a clean api to the user while being readable...so I guess it's fine.
	 **/
	stream(options) {
		return new ExposeStream(options = options || {}); 
	},

	/**
	   Returns a shallow, all-properties-enumerable-copy of the original object.
	   Symbols of the input object will be string keys, meaning collisions are possible.

	   Performance is supposedly really bad for setting the prototype of an instantiated object.
	   Therefore, start from the oldest ancestor and build up an object by going down the 
	   prototype chain.

	   returns Object
	 **/
	enumeralize(obj, _options) {
		const options = _options || {};
		const {regexp, keepSymbols, keepValues} = options;

		var prototypeChain = obj ? [obj] : [];
		var currPrototype;
		while(obj) {
			currPrototype = Object.getPrototypeOf(obj);
			if (currPrototype) {
				prototypeChain.push(currPrototype);
			}
			obj = currPrototype;
		}

		var currEnumerableObject;
		for(let i = prototypeChain.length - 1; i >= 0; i--) {
			currEnumerableObject = currEnumerableObject ? Object.create(currEnumerableObject) : Object.setPrototypeOf({}, null); // one-time-call
			currPrototype = prototypeChain[i];
			let propAssigner = propAssignerBase.bind(null, currEnumerableObject, currPrototype, regexp);
			
			Object.getOwnPropertyNames(currPrototype).forEach(propAssigner)
			Object.getOwnPropertySymbols(currPrototype).forEach(propAssigner);
		}


		function propAssignerBase(propsMap, obj, regexp, key) {
			const enumerableKey = typeof key === 'symbol' ? key.toString() : key
			const descriptor = Object.getOwnPropertyDescriptor(obj, key);
			descriptor.enumerable = true;
			
			if (regexp && !(enumerableKey.match(regexp))) return;
			if (descriptor.get || descriptor.set || descriptor.value || descriptor.writable || key === 'arguments' || key === 'caller') {
				Object.defineProperty(propsMap, enumerableKey, descriptor);
			} else {
				propsMap[enumerableKey] = obj[key];
			}
		}
		
		return currEnumerableObject;
	},
	/**
	   Get all keys in a nested object format. All values are by default mapped to true,
	   unless options.keepValues is truthy.

	   Collisions will occur between symbols and nonsymbols because
	   all properties are made as enumerable string properties.
	   There is no special expansion of objects that are mapped to by obj's keys.
	   In other words, values of symbols/nonenumerables/inherited properties of 
	   objects within obj will not be shown unless opt.keepValues is used. 

	   If the object in question has its own .inspect() function, you may want to use
	   util.inspect(curiousObj, {customInspect: false}) if you plan on console.logging.

	   returns Object
	**/
	allKeysNested(obj, {regexp, keepValues, keepSymbols} = {}) { // asNested
		//const options = _options || {};
		//const {regexp, keepValues, keepSymbols} = options;
		
		var lowestDescendentProps = {};
		var props = lowestDescendentProps;
		// argument order is important since I'm using this as a base to .bind() on
		const propAssignerBase = function(propsMap, obj, regexp, key)  {
			
			const enumerableKey = (typeof key === 'symbol') ? key.toString() : key;
			const descriptor = Object.getOwnPropertyDescriptor(obj, key);
			descriptor.enumerable = true;
			
			if (regexp && !(enumerableKey.match(regexp))) return;
			
			if (!keepValues){
				propsMap[enumerableKey] = true;
				return;
			} else if (keepValues) {
				propsMap = Object.defineProperty(propsMap, key, descriptor);
				return;
			}
			
			throw new Error("propAssignerBase broke!");
		}
		
		var propAssigner = propAssignerBase.bind(null, props, obj, regexp);
		var objParent;
		while(obj) {
			Object.getOwnPropertyNames(obj).forEach(propAssigner)
			Object.getOwnPropertySymbols(obj).forEach(propAssigner);

			objParent = Object.getPrototypeOf(obj);
			if (objParent) {
				props["__objParent"] = {};
				props = props["__objParent"];
			}
			obj = objParent;
			propAssigner = propAssignerBase.bind(null, props, obj, regexp);
		}
		
		return lowestDescendentProps;
	},

	/** These functions are modified versions of airportyh's answer on
		this SO post: http://stackoverflow.com/questions/8024149/is-it-possible-to-get-the-non-enumerable-inherited-property-names-of-an-object#answer-8024294
	
	   Get all keys in this format:
	   [
	   [] // obj props
	   [] // obj's parent's props
	   [] // obj's parent's parent's props
	   ...
	   ]

	   returns Array
	**/
	allKeysArrays(obj, options) { // asArrays
		options = options || {};
		const {regexp} = options;
		var props = [];
		var num = 0;
		// personally I dislike explicit branching when I can just write
		// two blocks while(obj && regexp) and while(obj)... but it might save cycles :/
		if (regexp) { 
			while(obj) {
				props[num] = Object.getOwnPropertyNames(obj).filter((prop) => {
					if (!prop.match(regexp)) return false;
					return true;
				})
				props[num] = props[num++].concat(Object.getOwnPropertyNames(obj).filter((prop) => {
					if (!prop.match(regexp)) return false;
					return true;
				}));
				obj = Object.getPrototypeOf(obj);
			}
		} else {
			while(obj) {
				props[num] = Object.getOwnPropertyNames(obj);
				props[num] = props[num++].concat(Object.getOwnPropertySymbols(obj));
				obj = Object.getPrototypeOf(obj);
			}
		}
		
		return props;
	},

	/**
	   Get all keys with no nesting in a single array.
	   Will contain duplicate keys if keys of the same name exists in
	   the prototype chain.

	   returns Array
	**/
	allKeysFlat(obj, options) { // asFlat
		
		var props = [];
		while(obj) {
			props = props.concat(Object.getOwnPropertyNames(obj));
			props = props.concat(Object.getOwnPropertySymbols(obj));
			obj = Object.getPrototypeOf(obj);			
		}
		return props;
	}
}

module.exports = expose;

function warnUser(options) {
	options = options || {};
	var unknownOpts = [];
	
	Object.keys(options).forEach((passedInOp) => {
		if (!(passedInOp in supportedOptions)) { unknownOpts.push(passedInOp)}
	});
	if ('objectMode' in options && !options.objectMode) {
		console.log("Expose forces objectMode to be true regardless of the value passed to expose.stream()");
	}
	if (unknownOpts.length > 0) console.log(`expose doesn\'t support these options passed in: ${unknownOpts}`,
											`\n but will pass them along to the constructor for the transform stream.`)
}
