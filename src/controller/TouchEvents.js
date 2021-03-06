//		xiNET Cross-link Viewer
//		Copyright 2013 Rappsilber Laboratory, University of Edinburgh
//
//		author: Colin Combe
//
//		TouchEvents.js

"use strict";

//static var's signifying Controller's status Are declared in MouseEvents.js
        
    //for pinch gestures, e.g. to zoom	
    // gesturestart, 
    // gesturechange, 
    // and gestureend
    //http://stackoverflow.com/questions/11183174/simplest-way-to-detect-a-pinch
    //https://developer.apple.com/library/safari/documentation/UserExperience/Reference/GestureEventClassReference/GestureEvent/GestureEvent.html 

/**
 * Handle touchstart event.
 */
xiNET.Controller.prototype.touchStart = function(evt) {
    //prevent default, but allow propogation
    evt.preventDefault();
    //~ //evt.returnValue = false;
    //~ this.preventDefaultsAndStopPropagation(evt);
    
    //stop force layout
    if (typeof this.force !== 'undefined' && this.force != null) {
        this.force.stop();
    }
    
    var p = this.getTouchEventPoint(evt);// seems to be correct, see below
	this.dragStart = this.mouseToSVG(p.x, p.y);	
    this.state = xiNET.Controller.PANNING;
    //~ this.panned = false;
};

// dragging/rotation/panning/selecting
xiNET.Controller.prototype.touchMove = function(evt) {
    this.preventDefaultsAndStopPropagation(evt);
    this.message(this.dragStart);
    if (this.sequenceInitComplete) { // just being cautious
        var p = this.getTouchEventPoint(evt);// seems to be correct, see below
        var c = this.mouseToSVG(p.x, p.y);

        if (this.dragElement != null) { //dragging or rotating
            this.hideTooltip();
            var dx = this.dragStart.x - c.x;
            var dy = this.dragStart.y - c.y;

            if (this.state === xiNET.Controller.DRAGGING) {
                // we are currently dragging things around
                var ox, oy, nx, ny;
                if (typeof this.dragElement.x === 'undefined') { // if not a protein
                    //its a link - drag whole connected subgraph
                    var prot;
                    if (this.dragElement.fromProtein)
                        prot = this.dragElement.fromProtein;
                    else
                        prot = this.dragElement.proteinLink.fromProtein;
                    var prots = this.proteins.values();
                    var protCount = prots.length;
                    for (var p = 0; p < protCount; p++) {
                        prots[p].subgraph = null;
                    }
                    var subgraph = prot.getSubgraph();
                    var nodes = subgraph.nodes.values();
                    var nodeCount = nodes.length;
                    for (var i = 0; i < nodeCount; i++) {
                        var protein = nodes[i];
                        ox = protein.x;
                        oy = protein.y;
                        nx = ox - dx;
                        ny = oy - dy;
                        protein.setPosition(nx, ny);
                        protein.setAllLineCoordinates();
                    }
                    for (i = 0; i < nodeCount; i++) {
                        nodes[i].setAllLineCoordinates();
                    }
                } else {
                    //its a protein - drag it TODO: DRAG SELECTED
                    ox = this.dragElement.x;
                    oy = this.dragElement.y;
                    nx = ox - dx;
                    ny = oy - dy;
                    this.dragElement.setPosition(nx, ny);
                    this.dragElement.setAllLineCoordinates();
                }
                this.dragStart = c;
            }

            else if (this.state === xiNET.Controller.ROTATING) {
                // Distance from mouse x and center of stick.
                var _dx = c.x - this.dragElement.x
                // Distance from mouse y and center of stick.
                var _dy = c.y - this.dragElement.y;
                //see http://en.wikipedia.org/wiki/Atan2#Motivation
                var centreToMouseAngleRads = Math.atan2(_dy, _dx);
                if (this.whichRotator === 0) {
                    centreToMouseAngleRads = centreToMouseAngleRads + Math.PI;
                }
                var centreToMouseAngleDegrees = centreToMouseAngleRads * (360 / (2 * Math.PI));
                this.dragElement.setRotation(centreToMouseAngleDegrees);
                this.dragElement.setAllLineCoordinates();
            }
            else { //not dragging or rotating yet, maybe we should start
                // don't start dragging just on a click - we need to move the mouse a bit first
                if (Math.sqrt(dx * dx + dy * dy) > (5 * this.z)) {
                    this.state = xiNET.Controller.DRAGGING;

                }
            }
        }

//    else if (this.state === xiNET.Controller.SELECTING) {
//        this.updateMarquee(this.marquee, c);
//    }
        else 
        {
        
        //~ if (this.state === xiNET.Controller.PANNING) {
            xiNET.setCTM(this.container, this.container.getCTM()
				.translate(c.x - this.dragStart.x, c.y - this.dragStart.y));
        //~ }
        //~ else {
           //~ // this.showTooltip(p);
        //~ }
		}
    }
    return false;
};


// this ends all dragging and rotating
xiNET.Controller.prototype.touchEnd = function(evt) {
	this.preventDefaultsAndStopPropagation(evt);
	if (this.dragElement != null) { 
		if (!(this.state === xiNET.Controller.DRAGGING || this.state === xiNET.Controller.ROTATING)) { //not dragging or rotating
				if (typeof this.dragElement.x === 'undefined') { //if not protein
					this.dragElement.showID();
				} else {
					if (this.dragElement.form === 0) {
						this.dragElement.setForm(1);
					} else {
						this.dragElement.setForm(0);
					}
				}
			//~ this.checkLinks();
		}
		else if (this.state === xiNET.Controller.ROTATING) {
			//round protein rotation to nearest 5 degrees (looks neater)
			this.dragElement.setRotation(Math.round(this.dragElement.rotation / 5) * 5);
		}
		else {
		} //end of protein drag; do nothing
	}
	else if (/*this.state !== xiNET.Controller.PANNING &&*/ evt.ctrlKey === false) {
		this.clearSelection();
	}

	if (this.state === xiNET.Controller.SELECTING) {
		clearInterval(this.marcher);
		this.svgElement.removeChild(this.marquee);
	}
	this.dragElement = null;
	this.whichRotator = -1;
	this.state = xiNET.Controller.MOUSE_UP;

    return false;
};

/**
 * Handle gesture change event.
 */
xiNET.Controller.prototype.gestureChange = function(evt) {
    this.preventDefaultsAndStopPropagation(evt);
    var delta = evt.scale;
    //see http://stackoverflow.com/questions/5527601/normalizing-mousewheel-speed-across-browsers
    //~ if (evt.wheelDelta) {
        //~ delta = evt.wheelDelta / 3600; // Chrome/Safari
    //~ }
    //~ else {
        //~ delta = evt.detail / -90; // Mozilla
    //~ }
    var z = 1 + delta;
    var g = this.container;
    var p = this.getTouchEventPoint(evt);// seems to be correct, see above
    var c = this.mouseToSVG(p.x, p.y);
    var k = this.svgElement.createSVGMatrix().translate(c.x, c.y).scale(z).translate(-c.x, -c.y);
    xiNET.setCTM(g, g.getCTM().multiply(k));
    this.scale();
    return false;
};

//gets mouse position
xiNET.Controller.prototype.getTouchEventPoint = function(evt) {
    var p = this.svgElement.createSVGPoint();
//    var rect = this.container.getBoundingClientRect();
//   p.x = evt.clientX - rect.left;
//    p.y = evt.clientY - rect.top;
    var element = this.svgElement.parentNode;
    var top = 0, left = 0;
    do {
        top += element.offsetTop  || 0;
        left += element.offsetLeft || 0;
        element = element.offsetParent;
   } while(element);
   //TODO: should do equivalent for horizontal scroll also
	top += getScrollTop();
 //~ this.message("?");//this.dragStart);
       p.x = evt.touches[0].pageX - left;
    p.y = evt.touches[0].pageY - top;
 //~ var help = left;////evt.touches[0].pageX;//.toString();
  //~ this.message(JSON.stringify(help, null, '\t'));//this.dragStart);
   return p;
};
