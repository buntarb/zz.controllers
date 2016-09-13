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
goog.require( 'zz.environment.services.RAM' );

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
     * Application RAM.
     * @type {zz.environment.services.RAM}
     * @private
     */
    this.ram_ = zz.environment.services.RAM.getInstance( );

    /**
     * Root controller flag.
     * @type {boolean}
     * @private
     */
    this.isRoot_ = !this.env_.getRootController( );

    // Enabling all supported states.
    this.setSupportedState( goog.ui.Component.State.ALL, false );
    this.setSupportedState( goog.ui.Component.State.ACTIVE, true );
    this.setEnabled( true );
    this.setActive( true );
    this.setAllowTextSelection( true );

    // Enabling all auto states.
    this.setAutoStates( goog.ui.Component.State.ALL, true );

    // Setting up model.
    this.setModel( dataset );

    // Setting up view.
    this.setRenderer( view );

    if( this.isRoot_ ){

        // Setting up environment root controller.
        this.env_.setRootController( this );

        // Subscribe root controller for models changes.
        // TODO (buntarb): Investigate is it more efficient way?
        this.getModel( ).subscribe( this.getView( ) );

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
 * Add child controller for specified datarows field and render it.
 * @param {zz.models.Datarow} datarow
 * @param {string} field
 * @param {zz.controllers.FEBase} controller
 */
zz.controllers.FEBase.prototype.addFieldController = function( datarow, field, controller ){

    this.addChild( controller, false );
    controller.render( this.ram_.get(

        this.model_.getUid( ) + ':' +
        datarow.getUid( ) + ':' +
        field

    ).view );
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
                goog.events.EventType.FOCUS,
                goog.events.EventType.BLUR,
                goog.events.EventType.INPUT,
                goog.events.EventType.CHANGE ],

            this.handleClientEvent );

        if( goog.userAgent.IE ){

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
    this.renderer_.removeElement( this.model_.getUid( ) );
    this.ram_.delete( this.model_.getUid( ) );
    delete this.ram_;
    delete this.env_;
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

        var item = this.ram_.get( uid );
        switch( e.type ){

            case goog.events.EventType.MOUSEOVER:

                if( ~item.events.indexOf( goog.events.EventType.MOUSEOVER ) )

                    item.controller.handleMouseOver( e );

                break;

            case goog.events.EventType.MOUSEDOWN:

                if( ~item.events.indexOf( goog.events.EventType.MOUSEDOWN ) )

                    item.controller.handleMouseDown( e );

                break;

            case goog.events.EventType.MOUSEUP:

                if( ~item.events.indexOf( goog.events.EventType.MOUSEUP ) )

                    item.controller.handleMouseUp( e );

                break;

            case goog.events.EventType.MOUSEOUT:

                if( ~item.events.indexOf( goog.events.EventType.MOUSEOUT ) )

                    item.controller.handleMouseOut( e );

                break;

            case goog.events.KeyHandler.EventType.KEY:

                if( ~item.events.indexOf( goog.events.KeyHandler.EventType.KEY ) )

                    item.controller.handleKeyEvent( e );

                break;

            case goog.events.EventType.FOCUS:

                if( ~item.events.indexOf( goog.events.EventType.FOCUS ) )

                    item.controller.handleFocus( e );

                break;

            case goog.events.EventType.BLUR:

                if( ~item.events.indexOf( goog.events.EventType.BLUR ) )

                    item.controller.handleBlur( e );

                break;

            case goog.events.EventType.INPUT:

                if( ~item.events.indexOf( goog.events.EventType.INPUT ) )

                    item.controller.handleChange( e );

                break;

            case goog.events.EventType.CHANGE:

                if( ~item.events.indexOf( goog.events.EventType.CHANGE ) )

                    item.controller.handleChange( e );

                break;

            default:

                break;
        }
    }
};

/**
 * Performs the appropriate action when the control is activated by the user.
 * The default implementation first updates the checked and selected state of
 * controls that support them, then dispatches an ACTION event.  Considered
 * protected; should only be used within this package and by subclasses.
 * @param {goog.events.Event} e Event that triggered the action.
 * @return {boolean} Whether the action is allowed to proceed.
 * @protected
 * @override
 */
zz.controllers.FEBase.prototype.performActionInternal = function( e ){

    if( this.isAutoState( goog.ui.Component.State.CHECKED ) ){

        this.setChecked( !this.isChecked( ) );
    }
    if( this.isAutoState( goog.ui.Component.State.SELECTED ) ){

        this.setSelected( true );
    }
    if( this.isAutoState( goog.ui.Component.State.OPENED ) ){

        this.setOpen( !this.isOpen( ) );
    }
    var actionEvent = new goog.events.Event( goog.ui.Component.EventType.ACTION, this );
    if( e ){

        actionEvent.uid = this.renderer_.getElementUid( e.target );
        actionEvent.item = this.ram_.get( actionEvent.uid );
        actionEvent.altKey = e.altKey;
        actionEvent.ctrlKey = e.ctrlKey;
        actionEvent.metaKey = e.metaKey;
        actionEvent.shiftKey = e.shiftKey;
        actionEvent.platformModifierKey = e.platformModifierKey;
    }
    return this.dispatchEvent( actionEvent );
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