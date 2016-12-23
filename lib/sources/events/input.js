// Copyright 2016 Artem Lytvynov <buntarb@gmail.com>. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @license Apache-2.0
 * @copyright Artem Lytvynov <buntarb@gmail.com>
 */

goog.provide( 'zz.controllers.events.Input' );
goog.require( 'zz.events.BaseEvent' );
goog.require( 'zz.controllers.enums.EventType' );

/**
 * Controller input event class.
 * @param {Object} node
 * @param {*} old_value
 * @param {*} new_value
 * @extends {zz.events.BaseEvent}
 * @constructor
 */
zz.controllers.events.Input = function( node, old_value, new_value ){

	goog.base( this, zz.controllers.enums.EventType.INPUT );

	/**
	 * Controller, related with current event.
	 * @type {zz.controllers.FEBase}
	 */
	this.controller = node.controller;

	/**
	 * Datarow, related with current event.
	 * @type {zz.models.Datarow}
	 */
	this.model = node.model;

	/**
	 * Elements, related with current event.
	 * @type {Array<Element>}
	 */
	this.elements = node.elements;

	/**
	 * Old value.
	 * @type {*}
	 */
	this.oldValue = old_value;

	/**
	 * New value.
	 * @type {*}
	 */
	this.newValue = new_value;
};
goog.inherits( zz.controllers.events.Input, zz.events.BaseEvent );