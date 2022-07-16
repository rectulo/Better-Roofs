/*******************************************************
 * HELPER FUNCTIONS TO PROCESS THE LOGIC OF THE MODULE *
 *******************************************************/

class betterRoofsHelpers {
  /******************************************
   * MASK THE FOG WITH THE SPRITE OF A TILE *
   ******************************************/

  showTileThroughFog(tile) {
    if (!tile.visible) return this.hideTileThroughFog(tile);
    tile.alpha = 1;
    let oldSprite = _betterRoofs.fogRoofContainer.children.find(
      (c) => c.name == tile.id
    );
    let tileImg = tile.mesh;
    if (!tileImg || oldSprite || !tileImg.texture.baseTexture) return;
    let sprite = SpriteMesh.from(tileImg.texture, undefined, WhiteAsFuckShader);
    sprite.alpha = game.settings.get("betterroofs", "fogVisibility");
    sprite.width = tile.document.width;
    sprite.height = tile.document.height;
    sprite.position = tile.position;
    sprite.angle = tileImg.angle;
    //sprite.alpha = game.settings.get("betterroofs", "fogVisibility");
    //sprite.blendMode = 26;
    sprite.name = tile.id;
    _betterRoofs.fogRoofContainer.spriteIndex[tile.id] = sprite;
    _betterRoofs.fogRoofContainer.addChild(sprite);
  }

  /**********************************************************
   * REMOVE THE MASK SPRITE GENERATED BY SHOWTILETHROUGHFOG *
   **********************************************************/
  hideTileThroughFog(tile) {
    let sprite = _betterRoofs.fogRoofContainer.children.find(
      (c) => c.name == tile.id
    );
    if (sprite) _betterRoofs.fogRoofContainer.removeChild(sprite);
  }

  /**************************************************************
   * DECIDE IF A TILE SHOULD BE SHOWN OR HIDDEN THROUGH THE FOG *
   **************************************************************/

  computeShowHideTile(tile, overrideHide, controlledToken, brMode) {
    // USE THIS INSTEAD FOR V9 let pointSource = canvas.effects.visionSources.get(`Token.${controlledToken.id}`)?.los.points
    const pointSource = canvas.lighting.globalLight ?
        canvas.effects.visionSources.get(`Token.${controlledToken.id}`)?.los.points 
        : canvas.effects.visionSources.get(`Token.${controlledToken.id}`)?.fov.points

    if (
      !tile.occluded &&
      !overrideHide &&
      this.checkIfInPoly(pointSource, tile, controlledToken, 5)
    ) {
      this.showTileThroughFog(tile);
    } else {
      if (brMode == 2 && _betterRoofs.foregroundSightMaskContainers[tile.id]) {
        _betterRoofs.foregroundSightMaskContainers[tile.id].removeChildren();
        tile.mesh.mask = null;
      }
      this.hideTileThroughFog(tile);
    }
  }

  makeCircle(fov) {
    const center = {x: fov.x, y: fov.y};
    const radius = fov.radius;
    let points = [];
    let angle = 0;
    for (let i = 0; i < 360; i+=4) {
      let x = center.x + radius * Math.cos(angle);
      let y = center.y + radius * Math.sin(angle);
      points.push(x, y);
      angle += 0.1;
    }
    return points;
  }

  //given a center and an array of points, if a point is farther than the radius bring it closer to the center
  bringLosCloser(fov,los) {
    if(!fov || !los) return [];
    const center = {x: fov.x, y: fov.y}
    const points = los.points;
    const radius = fov.radius;
    let newPoints = [];
    for (let i = 0; i < points.length; i+=2) {
      let x = points[i];
      let y = points[i+1];
      let distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
      if (distance > radius) {
        let newX = center.x + (x - center.x) * radius / distance;
        let newY = center.y + (y - center.y) * radius / distance;
        newPoints.push(newX, newY);
      } else {
        newPoints.push(x, y);
      }
    }
    return newPoints;
  }

  /**********************************************************************
   * DECIDE IF A TILE SHOULD BE HIDDEN BASED ON SIGHT INSIDE A BUILDING *
   **********************************************************************/

  computeHide(controlledToken, tile, overrideHide) {
    if (
      this.checkIfInPoly(
        canvas.effects.visionSources.get(`Token.${controlledToken.id}`)?.los.points,
        tile,
        controlledToken,
        -5
      )
    ) {
      tile.alpha = tile.document.occlusion.alpha;
      this.hideTileThroughFog(tile);
      overrideHide = true;
    } else {
      tile.alpha = 1;
    }
    return overrideHide;
  }

  /*************************************************************************************
   * CHECK IF ANY POINT IN AN ARRAY OF POINTS IS CONTAINED INSIDE THE BUILDING POLYGON *
   *************************************************************************************/

  checkIfInPoly(points, tile, token, diff) {
    if (!points?.length) return false;
    points.push(points[0],points[1])
    for (let i = 0; i < points.length; i += 2) {
      
      if (points[i + 3]) { //&& (Math.pow(points[i]-points[i+2],2)+Math.pow(points[i+1]-points[i+3],2)) > 70000
        let midPoint = {
          x: (points[i + 2] + points[i]) / 2,
          y: (points[i + 3] + points[i + 1]) / 2,
        };
        let mpt = this.bringPointCloser(
          { x: midPoint.x, y: midPoint.y },
          token.center,
          diff
        );
        if (tile.containsPixel(mpt.x, mpt.y)) {
          return true;
        }
      }
      let pt = this.bringPointCloser(
        { x: points[i], y: points[i + 1] },
        token.center,
        diff
      );
      if (tile.containsPixel(pt.x, pt.y)) {
        return true;
      }
    }
    return false;
  }

  /**********************************
   * GET NECESSARY DATA FROM A TILE *
   **********************************/

  getTileFlags(tile) {
    let overrideHide = false;
    let brMode = tile.document.getFlag("betterroofs", "brMode");
    return { brMode, overrideHide };
  }

  getLevelsFlagsForObject(object) {
    let rangeTop = object.document.getFlag(CONFIG.Levels.MODULE_ID, "rangeTop");
    let rangeBottom = object.document.getFlag(CONFIG.Levels.MODULE_ID, "rangeBottom");
    if (rangeTop == null || rangeTop == undefined) rangeTop = Infinity;
    if (rangeBottom == null || rangeBottom == undefined)
      rangeBottom = -Infinity;
    let isLevel = rangeTop == Infinity ? false : true;
    if (rangeTop == Infinity && rangeBottom == -Infinity) return false;
    if (rangeTop == Infinity) rangeBottom -= 1;
    return { rangeBottom, rangeTop, isLevel };
  }

  getWallHeight(wall) {
    if(!_betterRoofs.isWallHeight) return [-Infinity, Infinity]
    const {top, bottom} = WallHeight.getWallBounds(wall);
    return [bottom, top];
  }

  /***************************************************************************************
   * GIVEN A POINT AND A CENTER GET THE POINT CLOSER TO THE CENTER BY THE SPECIFIED DIFF *
   ***************************************************************************************/

  bringPointCloser(point, center, diff) {
    let slope = this.getSlope(point, center);
    let newL = this.getDist(point, center) + diff;
    let x = -newL * Math.cos(slope) + center.x;
    let y = -newL * Math.sin(slope) + center.y;
    return { x: x, y: y };
  }

  
  /***********************************************
   * GET THE SLOPE IN RADIANS BETWEEN TWO POINTS *
   ***********************************************/

   getSlope(pt1, pt2) {
    return Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
  }

  /*************************************************
   * GET THE DISTANCE IN PIXELS BETWEEN TWO POINTS *
   *************************************************/

  getDist(pt1, pt2) {
    return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2));
  }

  /*******************************************
   * CREATE WALLS ON THE EDGES OF THE CANVAS *
   *******************************************/

  async buildEdgeWalls() {
    let padX = canvas.scene.dimensions.paddingX + 5;
    let padY = canvas.scene.dimensions.paddingY + 5;
    let width = canvas.scene.dimensions.width - 2 * padX - 5;
    let height = canvas.scene.dimensions.height - 2 * padY - 5;
    let wallsCoords = [
      [padX, padY, padX + width, padY],
      [padX + width, padY, padX + width, padY + height],
      [padX + width, padY + height, padX, padY + height],
      [padX, padY + height, padX, padY],
    ];
    let wallDataArray = [];
    for (let c of wallsCoords) {
      wallDataArray.push({
        c: c,
        move: 1,
        sense: 1,
        sound: 1,
        dir: 0,
        door: 0,
        ds: 0,
      });
    }
    await canvas.scene.createEmbeddedDocuments("Wall", wallDataArray);
  }

  /************************
   * SIMPLE YES NO PROMPT *
   ************************/

  async yesNoPrompt(dTitle, dContent) {
    let dialog = new Promise((resolve, reject) => {
      new Dialog({
        title: `${dTitle}`,
        content: `<p>${dContent}</p>`,
        buttons: {
          one: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("betterroofs.yesnodialog.yes"),
            callback: () => {
              resolve(true);
            },
          },
          two: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("betterroofs.yesnodialog.no"),
            callback: () => {
              resolve(false);
            },
          },
        },
        default: "two",
      }).render(true);
    });
    let result = await dialog;
    return result;
  }

  /*******************************
   * SAVE THE TILE CONFIGURATION *
   *******************************/

  async saveTileConfig(event) {
    let html = this.offsetParent;
    if (
      !canvas.tiles.get(event.document.id)
    )
      return;
    await event.document.setFlag(
      "betterroofs",
      "brMode",
      html.querySelectorAll("select[name ='br.mode']")[0].value
    );
    _betterRoofs.initializeRoofs();
    _betterRoofs.initializePIXIcontainers();
  }
}

//funny name haha

class WhiteAsFuckShader extends BaseSamplerShader{
  static classPluginName = null;

  static fragmentShader = `
    precision ${PIXI.settings.PRECISION_FRAGMENT} float;
    uniform sampler2D sampler;
    uniform vec4 tintAlpha;
    varying vec2 vUvs;
  
    void main() {
      gl_FragColor = vec4(1.0) * (texture2D(sampler, vUvs).a * tintAlpha);
    }`;
    
}