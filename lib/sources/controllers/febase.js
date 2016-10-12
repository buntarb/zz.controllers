/**
 * @fileoverview Provide zz.controllers.FEBase class.
 * @license Apache-2.0
 * @author buntarb@gmail.com (Artem Lytvynov)
 * @author popkov.aleksander@gmail.com (Popkov Alexander)
 */

goog.provide( 'zz.controllers.FEBase' );

goog.require( 'goog.dom' );
goog.require( 'goog.ui.Control' );
goog.require( 'goog.ui.Component.State' );
goog.require( 'goog.ui.Component.EventType' );
goog.require( 'goog.events.Event' );
goog.require( 'goog.events.KeyHandler.EventType' );
goog.require( 'zz.environment.services.Environment' );
goog.require( 'zz.environment.services.MVCTree' );
goog.require( 'zz.environment.enums.ViewElementAttribute' );
goog.require( 'zz.environment.enums.ViewElementAttributeCode' );
goog.require( 'zz.controllers.events.Enter' );
goog.require( 'zz.controllers.events.Leave' );
goog.require( 'zz.controllers.events.Action' );
goog.require( 'zz.controllers.events.Focus' );
goog.require( 'zz.controllers.events.Blur' );

/**
 * Base implementation of FE controllers.
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
     * Application environment.
     * @type {zz.environment.services.Environment}
     * @private
     */
    this.env_ = zz.environment.services.Environment.getInstance( );

    /**
     * Application MVC Tree.
     * @type {zz.environment.services.MVCTree}
     * @private
     */
    this.mvcTree_ = zz.environment.services.MVCTree.getInstance( );

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
        // TODO (buntarb): Move this id to globals.
        this.render( goog.dom.getElement( 'root' ) );
    }
};
goog.inherits( zz.controllers.FEBase, goog.ui.Control );

/**
 * Determine is current controller root or no.
 * @returns {boolean}
 */
zz.controllers.FEBase.prototype.isRoot = function( ){

    return this.isRoot_;
}

/**
 * Return current view.
 * @returns {zz.views.FEBase}
 */
zz.controllers.FEBase.prototype.getView = function( ){

    return this.getRenderer( );
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

        // TODO (buntarb): Move it to Environment.

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

        handler.listen( element, [

                goog.events.EventType.FOCUS,
                goog.events.EventType.BLUR ],

            this.handleClientEvent, true );

        if( goog.userAgent.IE ){

            handler.listen( element, [

                    goog.events.EventType.FOCUSIN,
                    goog.events.EventType.FOCUSOUT ],

                this.handleClientEvent );

            if( !this.ieMouseEventSequenceSimulator_ ){

                this.ieMouseEventSequenceSimulator_ =

                    new goog.ui.Control.IeMouseEventSequenceSimulator_( this );

                this.registerDisposable( this.ieMouseEventSequenceSimulator_ );
            }
        }
    }
};

/** @override */
zz.controllers.FEBase.prototype.disposeInternal = function( ){

    if( this.model_.firstDatarow( ) ){

        while( this.model_.deleteCurrent( ) );
    }
    this.mvcTree_.deleteNode( this.model_.getUid( ) );
    this.model_.dispose( );
    this.getParent( ).removeChild( this );
    goog.base( this, 'disposeInternal' );
};

/**
 * Attempts to handle client events.
 * @param {goog.events.Event} e
 */
zz.controllers.FEBase.prototype.handleClientEvent = function( e ){

    var uid;
    if( uid = this.renderer_.getElementUid( e.target ) ){

        var node = this.mvcTree_.getNode( uid );
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
    switch( e.type ){

        case goog.events.EventType.MOUSEDOWN:

            if( node ) {

                node.controller.handleMouseDown( e );

            }else{

                if( this.renderer_.getActionElement( this, e.target ) ){

                    node = this.mvcTree_.getNode(

                        this.renderer_.getElementUid(

                            this.renderer_.getActionElement( this, e.target ) ) );

                    node.controller.handleMouseDown( e );
                };
            }
            break;

        case goog.events.EventType.MOUSEUP:

            if( node ) {

                node.controller.handleMouseUp( e );

            }else{

                if( this.renderer_.getActionElement( this, e.target ) ){

                    node = this.mvcTree_.getNode(

                        this.renderer_.getElementUid(

                            this.renderer_.getActionElement( this, e.target ) ) );

                    node.controller.handleMouseUp( e );
                };
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
 * @override
 */
zz.controllers.FEBase.prototype.handleMouseOver = function( e ){

    if( this.renderer_.isHoverHandled( e.target ) ){

        var node = this.mvcTree_.getNode( this.renderer_.getElementUid( e.target ) );
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

        var node = this.mvcTree_.getNode( this.renderer_.getElementUid( e.target ) );
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
zz.controllers.FEBase.prototype.handleMouseUp = function( e ){

    var actionElement = this.renderer_.getActionElement( this, e.target );
    if( actionElement ){

        var node = this.mvcTree_.getNode( this.renderer_.getElementUid( actionElement ) );
        this.dispatchEvent( new zz.controllers.events.Action( node ) );
    }
    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleMouseUp', e );
};

/**
 * @override
 */
zz.controllers.FEBase.prototype.handleFocus = function( e ){

    var uid = this.renderer_.getElementUid( e.target );

    // TODO (buntarb): Move it to mvcTree_.
    var key =

        this.mvcTree_.getInternalSeparator( ) +
        zz.environment.enums.ViewElementAttributeCode.FOCUS +
        this.mvcTree_.getInternalSeparator( );

    // TODO (buntarb): Add RegExp here.
    if( ~uid.indexOf( key ) ){

        var node = this.mvcTree_.getNode( uid );
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

    // TODO (buntarb): Move it to mvcTree_.
    var key =

        this.mvcTree_.getInternalSeparator( ) +
        zz.environment.enums.ViewElementAttributeCode.BLUR +
        this.mvcTree_.getInternalSeparator( );

    // TODO (buntarb): Add RegExp here.
    if( ~uid.indexOf( key ) ){

        var node = this.mvcTree_.getNode( uid );
        this.dispatchEvent( new zz.controllers.events.Blur( node ) );
    }

    // Running goog.ui.Control standard flow.
    goog.base( this, 'handleBlur', e );
};

/**
 * Attempts to handle a UI changes.
 * @param {goog.events.Event} e
 */
zz.controllers.FEBase.prototype.handleChange = function( e ){

    var uid = this.renderer_.getElementUid( e.target );
    var field = this.renderer_.getFieldByUid( uid );
    var changeEvent = new goog.events.Event( goog.ui.Component.EventType.CHANGE, this );
    var item = this.ram_.get( uid );
        item.model[ field ] = this.renderer_.getFieldValue( e.target );

    if( e ){

        changeEvent.uid = uid;
        changeEvent.item = item;
        changeEvent.altKey = e.altKey;
        changeEvent.ctrlKey = e.ctrlKey;
        changeEvent.metaKey = e.metaKey;
        changeEvent.shiftKey = e.shiftKey;
        changeEvent.platformModifierKey = e.platformModifierKey;
    }
    this.dispatchEvent( changeEvent );
};