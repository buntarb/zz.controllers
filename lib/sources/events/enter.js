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

goog.provide( 'zz.controllers.events.Enter' );
goog.require( 'goog.events.Event' );
goog.require( 'zz.events.BaseEvent' );
goog.require( 'zz.controllers.enums.EventType' );

/**
 * Controller enter event class.
 * @param {Object} node
 * @extends {zz.events.BaseEvent}
 * @constructor
 */
zz.controllers.events.Enter = function( node ){

	goog.base( this, zz.controllers.enums.EventType.ENTER );
	this.controller = node.controller;
	this.model = node.model;
	this.elements = node.elements;
};
goog.inherits( zz.controllers.events.Enter, zz.events.BaseEvent );