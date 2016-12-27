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
 * @fileoverview Provide zz.controllers.FEBase class.
 * @license Apache-2.0
 * @copyright Artem Lytvynov <buntarb@gmail.com>
 */
goog.provide( 'zz.controllers.FEBase' );
goog.require( 'goog.dom' );
goog.require( 'goog.asserts' );
goog.require( 'goog.ui.Control' );
goog.require( 'goog.ui.Component.State' );
goog.require( 'goog.ui.Component.EventType' );
goog.require( 'goog.events.Event' );
goog.require( 'goog.events.KeyHandler' );
goog.require( 'goog.events.KeyHandler.EventType' );
goog.require( 'zz.environment.services.Environment' );
goog.require( 'zz.environment.services.MVCRegistry' );
goog.require( 'zz.views.enums.FEBaseElementAttributeCode' );
goog.require( 'zz.controllers.events.Enter' );
goog.require( 'zz.controllers.events.Leave' );
goog.require( 'zz.controllers.events.Action' );
goog.require( 'zz.controllers.events.Input' );
goog.require( 'zz.controllers.events.Focus' );
goog.require( 'zz.controllers.events.Blur' );
goog.require( 'zz.controllers.events.Key' );

/**
 * Base implementation of FE controllers. Controllers DOM will be
 * rendered in {@code opt_rootElement} element or element with id="root".
 * @param {zz.models.Dataset} dataset
 * @param {zz.views.FEBase} view
 * @param {goog.dom.DomHelper=} opt_dom
 * @extends {goog.ui.Control}
 * @constructor
 */
zz.controllers.FEBase = function( dataset, view, opt_dom ){

    // TODO (buntarb): Add assertion here.

    // Calling superclass.
    goog.base( this, dataset.getUid( ), view, opt_dom );

    /**
     * Element where controller will be rendered.
     * @type {Element}
     * @protected
     */
    this.wrapperElementInternal = this.wrapperElementInternal ||
        goog.dom.getElement( 'root' );

    /**
     * Application environment.
     * @type {zz.environment.services.Environment}
     * @private
     */
    this.env_ = zz.environment.services.Environment.getInstance( );

    /**
     * Application MVC registry.
     * @type {zz.environment.services.MVCRegistry}
     * @private
     */
    this.mvcRegistry_ = zz.environment.services.MVCRegistry.getInstance( );

    /**
     * Hash object for storing additional active (pressed)
     * action-elements listeners.
     * @type {{}}
     * @private
     */
    this.activeActionElementsStack_ = {};

    /**
     * Root controller flag.
     * @type {boolean}
     * @private
     */
    this.isRoot_ = !this.env_.getRootController( );

    // Setting up goog.ui.Control
    this.setSupportedState( goog.ui.Component.State.ALL, false );
    this.setEnabled( true );
    this.setActive( true );
    this.setAllowTextSelection( true );
    this.setAutoStates( goog.ui.Component.State.ALL, false );

    // Setting up model.
    this.setModel( dataset );

    // Setting up view.
    this.setRenderer( view );

    if( this.isRoot_ ){

        // Setting up environment root controller.
        this.env_.setRootController( this );

        // Render root app view into root app element.
        this.render( this.wrapperElementInternal );
    }
};
goog.inherits( zz.controllers.FEBase, goog.ui.Control );

/**
 * Determine is current controller root or no.
 * @returns {boolean}
 */
zz.controllers.FEBase.prototype.isRoot = function( ){

    return this.isRoot_;
};

/**
 * Return current view.
 * @returns {zz.views.FEBase}
 */
zz.controllers.FEBase.prototype.getView = function( ){

    return /** @type {zz.views.FEBase} */( this.getRenderer( ) );
};

/**
 * Called when the component's element is known to be in the document. Anything
 * using document.getElementById etc. should be done at this stage.
 *
 * If the component contains child components, this call is propagated to its
 * children.
 *
 * Configures the component after its DOM has been rendered, and sets up event
 * handling.
 */
zz.controllers.FEBase.prototype.enterDocument = function( ){

    // goog.ui.Component part -------------------------------------------------------

    // TODO (buntarb): Check this carefuly: are privates rewriting correctly or not.
    this.inDocument_ = true;

    // Propagate enterDocument to child components that have a DOM, if any.
    // If a child was decorated before entering the document (permitted when
    // goog.ui.Component.ALLOW_DETACHED_DECORATION is true), its enterDocument
    // will be called here.
    this.forEachChild( function( child ){

        if( !child.isInDocument( ) && child.getElement( ) ){

            child.enterDocument( );
        }
    } );

    // goog.ui.Control part ---------------------------------------------------------

    // Call the renderer's setAriaStates method to set element's aria attributes.
    this.renderer_.setAriaStates( this, this.getElementStrict( ) );

    // Call the renderer's initializeDom method to configure properties of the
    // control's DOM that can only be done once it's in the document.
    this.renderer_.initializeDom( this );

    // zz.controllers.FEBase part ---------------------------------------------------

    // Initialize event handling for root controller only.
    if( this.isRoot_ ){

        // TODO (buntarb): Move it to Environment(?).

        // Initialize mouse event handling if the control is configured to handle
        // its own mouse events.  (Controls hosted in containers don't need to
        // handle their own mouse events.)
        var handler = this.getHandler( );
        var element = this.getElement( );
        var keyHandler = this.getKeyHandler( );

        // Initialize keyboard event handling if the control is focusable and has
        // a key event target.  (Controls hosted in containers typically aren't
        // focusable, allowing their container to handle keyboard events for them.)
        keyHandler.attach( element );
        handler.listen( element, [

                goog.events.EventType.MOUSEOVER,
                goog.events.EventType.MOUSEDOWN,
                goog.events.EventType.MOUSEUP,
                goog.events.EventType.MOUSEOUT,
                goog.events.KeyHandler.EventType.KEY,
                goog.events.EventType.INPUT,
                goog.events.EventType.CHANGE ],

            this.handleClientEvent, false );

        if( goog.userAgent.IE ){

            if( !this.ieMouseEventSequenceSimulator_ ){

                //noinspection JSAccessibilityCheck
                this.ieMouseEventSequenceSimulator_ =

                    new goog.ui.Control.IeMouseEventSequenceSimulator_( this );

                this.registerDisposable( this.ieMouseEventSequenceSimulator_ );
            }
        }
    }
    this.setupListenersInternal( );
    this.setupModelInternal( );
    this.bootstrap( );
};

/** @override */
zz.controllers.FEBase.prototype.disposeInternal = function( ){

    this.destroy( );
    if( this.model_.firstDatarow( ) ){

        while( this.model_.deleteCurrent( ) ){}
    }
    this.mvcRegistry_.delete( this.model_.getUid( ).toString( ) );
    this.model_.dispose( );
    if( !this.isRoot_ ){

        this.getParent( ).removeChild( this );
    }
    this.env_ = null;
    this.mvcRegistry_ = null;
    goog.base( this, 'disposeInternal' );
};

/**
 * Returns application environment.
 * @returns {zz.environment.services.Environment}
 */
zz.controllers.FEBase.prototype.getEnvironment = function( ){

    return this.env_;
};

/**
 * Returns application MVC registry.
 * @returns {zz.environment.services.MVCRegistry}
 */
zz.controllers.FEBase.prototype.getMVCRegistry = function( ){

    return this.mvcRegistry_;
};

/**
 * Setting up controllers listeners. By default do nothing.
 * This method should be overriden in inherited classes. You should use it
 * to enable all necessary listeners with {@code this.getHandler( ).listen}
 * or {@code this.getHandler( ).listenWithScope}.
 * @protected
 */
zz.controllers.FEBase.prototype.setupListenersInternal = function( ){ };

/**
 * Setting up model after controller initialized and listeners are setting up.
 * This means, that you can make some changes in your controllers model: create
 * new datarows, update some fields in existing datarows if any, etc. By default do
 * nothing. This method should be overriden in inherited classes.
 * @protected
 */
zz.controllers.FEBase.prototype.setupModelInternal = function( ){ };

/**
 * This method will be run after {@code zz.controllers.FEBase#setupListenersInternal}
 * and {@code zz.controllers.FEBase#setupModelInternal} methods. Here some additional
 * logic could be runned. Should be override in child class. Do nothing by default.
 */
zz.controllers.FEBase.prototype.bootstrap = function( ){ };

/**
 * This method will be run from {@code zz.controllers.FEBase#dispose} method,
 * so some additional logic could be added here. Should be override in inherited
 * classes. Do nothing by default.
 */
zz.controllers.FEBase.prototype.destroy = function( ){ };

/**
 * Add child controller and render it into {@code opt_wrapper} element if specified,
 * or current controller root element if not.
 * @param {zz.controllers.FEBase} controller
 * @param {Element=} opt_wrapper
 */
zz.controllers.FEBase.prototype.renderChildController = function( controller, opt_wrapper ){

    if( goog.isDef( opt_wrapper ) &&
        goog.asserts.assertElement(

            opt_wrapper,
            'opt_wrapper should be an Element type' ) ){

        this.addChild( controller, false );
        controller.render( opt_wrapper );

    }else{

        this.addChild( controller, true );
    }
};

/**
 * Enable focus and blur handling on specified element.
 * @param {Element} element
 */
zz.controllers.FEBase.prototype.enableFocusHandling = function( element ){

    this
        .getHandler( )
        .listen(

            element, [

                goog.events.EventType.FOCUS,
                goog.events.EventType.BLUR ],

            this.handleClientEvent );
};

/**
 * Enable key handling on specified element.
 * @param {Element} element
 */
zz.controllers.FEBase.prototype.enableKeyHandling = function( element ){

    var keyHandler = new goog.events.KeyHandler( );
    keyHandler.attach( element );
    this
        .getHandler( )
        .listen(

            keyHandler,
            goog.events.KeyHandler.EventType.KEY,
            this.handleClientEvent );
};

/**
 * Enable/disable active action-element listeners.
 * @param {Element} element
 * @param {boolean} enable
 */
zz.controllers.FEBase.prototype.enableActiveHandling = function( element, enable ){

    var uid = this.renderer_.getElementUid( element );
    if( uid ){

        if( enable ){

            this.activeActionElementsStack_[ uid ] = true;
            this
                .getHandler( )
                .listenWithScope(

                    element, [

                        goog.events.EventType.MOUSEOUT,
                        goog.events.EventType.BLUR ],

                    this.handleActiveElement_,
                    false,
                    this
                );

        }else{


            if( this.activeActionElementsStack_[ uid ] ){

                delete this.activeActionElementsStack_[ uid ];
                this
                    .getHandler( )
                    .unlisten(

                        element, [

                            goog.events.EventType.MOUSEOUT,
                            goog.events.EventType.BLUR ],

                        this.handleActiveElement_,
                        false,
                        this
                    );
            }
        }
    }
};

/**
 * Attempts to handle client events.
 * @param {goog.events.Event} e
 */
zz.controllers.FEBase.prototype.handleClientEvent = function( e ){

    var uid;
    if( uid = this.renderer_.getElementUid( e.target ) ){

        var node = this.mvcRegistry_.get( uid );
        if( !node ){

            if( goog.DEBUG ){

                console.error( 'Missing node for uid: ' + uid );
            }
        }else{

            switch( e.type ){

                case goog.events.EventType.MOUSEOVER:

                    node.controller.handleMouseOver( e );
                    break;

                case goog.events.EventType.MOUSEOUT:

                    node.controller.handleMouseOut( e );
                    break;

                case goog.events.KeyHandler.EventType.KEY:

                    node.controller.handleKeyEvent( e );
                    break;

                case goog.events.EventType.FOCUS:

                    node.controller.handleFocus( e );
                    break;

                case goog.events.EventType.FOCUSIN:

                    node.controller.handleFocus( e );
                    break;

                case goog.events.EventType.BLUR:

                    node.controller.handleBlur( e );
                    break;

                case goog.events.EventType.FOCUSOUT:

                    node.controller.handleBlur( e );
                    break;

                case goog.events.EventType.INPUT:

                    node.controller.handleChange( e );
                    break;

                case goog.events.EventType.CHANGE:

                    node.controller.handleChange( e );
                    break;

                default:

                    break;
            }
        }
    }
    switch( e.type ){

        case goog.events.EventType.MOUSEDOWN:

            if( node ) {

                node.controller.handleMouseDown( e );

            }else{

                if( this.renderer_.getActionElement( this, e.target ) ){

                    node = this.mvcRegistry_.get(

                        this.renderer_.getElementUid(

                            this.renderer_.getActionElement( this, e.target ) ) );

                    node.controller.handleMouseDown( e );
                }
            }
            break;

        case goog.events.EventType.MOUSEUP:

            if( node ) {

                node.controller.handleMouseUp( e );

            }else{

                if( this.renderer_.getActionElement( this, e.target ) ){

                    node = this.mvcRegistry_.get(

                        this.renderer_.getElementUid(

                            this.renderer_.getActionElement( this, e.target ) ) );

                    node.controller.handleMouseUp( e );
                }
            }
            break;

        default:

            break;
    }
};

/**
 * Checks if a mouse event (mouseover or mouseout) occured below an element.
 * @param {goog.events.BrowserEvent} e Mouse event (should be mouseover or mouseout).
 * @param {Element} elem The ancestor element.
 * @return {boolean} Whether the event has a relatedTarget (the element the mouse is coming
 * from) and it's a descendent of elem.
 * @private
 */
zz.controllers.FEBase.prototype.isMouseEventWithinMarkedElement_ = function( e, elem ){

    // If relatedTarget is null, it means there was no previous element (e.g.
    // the mouse moved out of the window).  Assume this means that the mouse
    // event was not within the element.
    return !!e.relatedTarget && goog.dom.contains( elem, e.relatedTarget );
};

/**
 * Handle events for active action-element.
 * @param {goog.events.Event} e
 * @private
 */
zz.controllers.FEBase.prototype.handleActiveElement_ = function( e ){

    var uid = this.renderer_.getElementUid( e.target );
    if( uid ){

        this.enableActiveHandling( e.target, false );
    }
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleMouseOver = function( e ){

    if( this.renderer_.isHoverHandled( e.target ) ){

        var node = this.mvcRegistry_.get( this.renderer_.getElementUid( e.target ) );
        if( !this.isMouseEventWithinMarkedElement_( e, node.elements[ 0 ] ) ){

            this.dispatchEvent( new zz.controllers.events.Enter( node ) );
        }
    }
    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleMouseOver', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleMouseOut = function( e ){

    if( this.renderer_.isHoverHandled( e.target ) ){

        var node = this.mvcRegistry_.get( this.renderer_.getElementUid( e.target ) );
        if( !this.isMouseEventWithinMarkedElement_( e, node.elements[ 0 ] ) ){

            this.dispatchEvent( new zz.controllers.events.Leave( node ) );
        }
    }
    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleMouseOut', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleMouseDown = function( e ){

    var actionElement = this.renderer_.getActionElement( this, e.target );
    if( actionElement ){

        this.enableActiveHandling( actionElement, true );
    }
    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleMouseDown', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleMouseUp = function( e ){

    var actionElement = this.renderer_.getActionElement( this, e.target );
    if( actionElement ){

        var uid = this.renderer_.getElementUid( actionElement );
        if( this.activeActionElementsStack_[ uid ] ){

            this.enableActiveHandling( actionElement, false );
            this.dispatchEvent(
                new zz.controllers.events.Action(
                    this.mvcRegistry_
                        .get(
                            this.renderer_
                                .getElementUid( actionElement ) ) ) );
        }
    }
    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleMouseUp', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleFocus = function( e ){

    var uid = this.renderer_.getElementUid( e.target );

    // TODO (buntarb): Move it to view(?).
    var key =

        this.getView( ).getInternalSeparator( ) +
        zz.views.enums.FEBaseElementAttributeCode.FOCUS +
        this.getView( ).getInternalSeparator( );

    // TODO (buntarb): Add RegExp here.
    if( ~uid.indexOf( key ) ){

        var node = this.mvcRegistry_.get( uid );
        this.dispatchEvent( new zz.controllers.events.Focus( node ) );
    }

    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleFocus', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleBlur = function( e ){

    var uid = this.renderer_.getElementUid( e.target );

    // TODO (buntarb): Move it to view(?).
    var key =

        this.getView( ).getInternalSeparator( ) +
        zz.views.enums.FEBaseElementAttributeCode.BLUR +
        this.getView( ).getInternalSeparator( );

    // TODO (buntarb): Add RegExp here.
    if( ~uid.indexOf( key ) ){

        var node = this.mvcRegistry_.get( uid );
        this.dispatchEvent( new zz.controllers.events.Blur( node ) );
    }

    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleBlur', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleKeyEvent = function( e ){

    var uid = this.renderer_.getElementUid( e.target );
    if( uid ){

        var node = this.mvcRegistry_.get( uid );
        this.dispatchEvent(

            new zz.controllers.events.Key(

                node,
                e.keyCode,
                e.charCode,
                e.repeat ) );
    }
};

/**
 * Attempts to handle a UI changes.
 * @param {goog.events.Event} e
 */
zz.controllers.FEBase.prototype.handleChange = function( e ){

    var uid = this.renderer_.getElementUid( e.target );
    var node = this.mvcRegistry_.get( uid );
    var field = this.getView( ).getFieldByUid( uid );
    var oldVal = node.model[ field ];
    var newVal = this.renderer_.getElementValue( e.target );
    if( oldVal !== newVal ){

        node.model[ field ] = newVal;
        this.dispatchEvent( new zz.controllers.events.Input( node, oldVal, newVal ) );
    }
};