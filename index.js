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
	method: true,
	verbose: true,
	customInspect: true,
	keepValues: true,
	objectMode: true, //but really, we force the stream into object mode
	keepValues: true,
	keepSymbols: true,
	regexp: true
}

function defaultOptions(arg1) {
	console.log("arg1:------->  ", arg1);
	return {
		method: "allKeysFlat",
		objectMode: true,
		verbose: false,
		customInspect: false,
		keepValues: false,
		keepSymbols: false,
		regexp: false
	}
}

// how to give this regexes?
// I want to do fancy destructuring here
const ExposeStream  = function(options

// 	{
// 	method = "allKeysFlat",
// 	objectMode: this.opt.objectMode = true,
// 	verbose: this.opt.verbose = false,
// 	customInspect: this.opt.customInspect = false,
// 	keepValues = this.opt.false,
// 	keepSymbols = false,
// 	regexp = false
// } = {}
//= {
// 	method: "allKeysArrays",
// 	objectMode: true,
// 	verbose: false,
// 	customInspect: false,
// 	keepValues: false,
// 	keepSymbols: false,
// 	regexp: false
// }
							  ) { // You can have default options in es6, but can you do them with destructuring?
	if (!(this instanceof ExposeStream)) {
		return new ExposeStream(options);
	}
	
	//if (options === null) options = defaultOptions(); //
	options = options || {};
	this.opt = {}, opt = this.opt; // 3 char short-hand
	({
		method = "allKeysFlat",
		
		objectMode: opt.objectMode = true,
		verbose: opt.verbose = false,
		customInspect: opt.customInspect = false,
		keepValues: opt.keepValues = false,
		keepSymbols: opt.keepSymbols = false,
		//regexp: opt.regexp = false
	} = options);
	this.opt.exposeMethod = expose[method] || expose.allKeysFlat

	// console.log(this.method, objectMode, verbose, customInspect, keepValues, keepSymbols, regexp)

	
	// console.log("this.opt: ", this.opt);


	// //console.log(options.method, options.objectMode, options.verbose, options.customInspect, options.keepValues, options.keepSymbols, options.regexp)
	// //console.log(method, objectMode, verbose, customInspect, keepValues, keepSymbols, regexp)
	// console.log("args: ", arguments);
	// //var options = arguments[0];
	// //console.trace("verbose undefined")
	// console.log("options: ", options);
	if (opt.verbose) warnUser(options);
	
	//options.objectMode = true; // why would you want objectMode to ever be false? Errors would happen!
	//this.opt = options;
	//console.log("---> ", options);
	//var method = options.method;
	
	// Explicitly declare all fields in this.opt object
	// const methodName = options.method;
	// this.opt.exposeMethod = expose[method] || expose.allKeysFlat; // consider changing default to allKeysNested
	// this.opt.objectMode = true; //options.objectMode = ('objectMode' in options) ? options.objectMode : true; 
	// this.opt.verbose = ('verbose' in options) ? options.verbose : false;
	// this.opt.customInspect = ('customInspect' in options) ? options.customInspect : false;
	// this.opt.keepValues = ('keepValues' in options) ? options.keepValues : false;
	// this.opt.keepSymbols = ('keepSymbols' in options) ? options.keepSymbols : false; // TODO: Implement

	Transform.call(this, this.opt);
}

ExposeStream.prototype._transform = function(obj, enc, cb) {
	const exposedObj = this.opt.exposeMethod(obj, this.opt);
	if (this.opt.verbose) {
		console.log("");
		console.log(util.inspect(exposedObj, {customInspect: this.opt.customInspect})); //careful about this references here
		console.log("");
	}

	cb(null, exposedObj);
}
util.inherits(ExposeStream, Transform);

const expose = {
	
	stream(options) {
		return new ExposeStream(options);
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
		
		var props = [];
		var num = 0;
		while(obj) {
			props[num] = Object.getOwnPropertyNames(obj);
			props[num] = props[num++].concat(Object.getOwnPropertySymbols(obj));
			obj = Object.getPrototypeOf(obj);
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
	var unknownOpts = [];
	Object.keys(options).forEach((passedInOp) => {
		if (!(passedInOp in supportedOptions)) { unknownOpts.push(passedInOp)}
	});
	if (unknownOpts.length > 0) console.log(`expose doesn\'t support these options passed in: ${unknownOpts}`,
											`\n but will pass them along to the constructor for the transform stream.`)
}
