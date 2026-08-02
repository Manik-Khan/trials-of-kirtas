(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ForgeDioramaRenderer=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  var SCHEMA='forge-diorama-render/v1';
  var TYPES={water:0,grass:1,stone:2,plaza:3,rock:4};
  var SIDES=[
    {key:'n',dc:0,dr:-1,axis:'ns'},
    {key:'e',dc:1,dr:0,axis:'ew'},
    {key:'s',dc:0,dr:1,axis:'ns'},
    {key:'w',dc:-1,dr:0,axis:'ew'}
  ];

  function finite(value,fallback){value=Number(value);return Number.isFinite(value)?value:fallback;}
  function at(field,c,r){return c<0||r<0||c>=field.W||r>=field.H?-1:r*field.W+c;}
  function ownsFloor(field,index){
    var type=Number(field.type[index]);
    return !!field.foot[index]&&type!==TYPES.water&&type!==TYPES.rock;
  }
  function cloneRecord(value){var out={};Object.keys(value).forEach(function(key){out[key]=value[key];});return out;}
  function validateField(field){
    if(!field||!Number.isInteger(field.W)||!Number.isInteger(field.H)||field.W<1||field.H<1)throw new Error('Diorama renderer needs a field with positive W and H');
    var n=field.W*field.H;
    ['foot','height','type'].forEach(function(key){if(!field[key]||field[key].length!==n)throw new Error('Diorama renderer field.'+key+' must contain '+n+' cells');});
    return n;
  }
  function plan(field,options){
    validateField(field);options=options||{};
    var step=finite(options.step,1),stepFt=finite(options.stepFt,5),occ=field.occ||[],floors=[],water=[],volumes=[],walls=[],props=[];
    for(var r=0;r<field.H;r++)for(var c=0;c<field.W;c++){
      var index=r*field.W+c;if(!field.foot[index])continue;
      var type=Number(field.type[index]),elevationFt=finite(field.height[index],0)*stepFt,y=elevationFt/stepFt*step;
      if(type===TYPES.water){water.push({c:c,r:r,index:index,type:type,y:y});continue;}
      if(type===TYPES.rock){
        var rockTopFt=elevationFt+Math.max(stepFt,finite(occ[index],stepFt));
        volumes.push({c:c,r:r,index:index,type:type,bottomY:0,topY:rockTopFt/stepFt*step});
        continue;
      }
      floors.push({c:c,r:r,index:index,type:type,y:y});
      if(y>0.08)volumes.push({c:c,r:r,index:index,type:type,bottomY:0,topY:y});
      SIDES.forEach(function(side){
        var ni=at(field,c+side.dc,r+side.dr),neighbor=ni<0?null:{foot:!!field.foot[ni],type:Number(field.type[ni])};
        if(!neighbor||!neighbor.foot||neighbor.type===TYPES.rock){
          walls.push({c:c,r:r,index:index,side:side.key,axis:side.axis,y:y,cutaway:side.key==='s'||side.key==='e'});
        }
      });
    }
    (field.props||[]).forEach(function(item){
      if(item&&Number.isFinite(Number(item.x))&&Number.isFinite(Number(item.y)))props.push(cloneRecord(item));
    });
    return {schema:SCHEMA,W:field.W,H:field.H,step:step,stepFt:stepFt,floors:floors,water:water,volumes:volumes,walls:walls,props:props};
  }

  function paletteFor(biome){
    var palettes={
      grass:{grass:0x71834b,stone:0x9c8d72,plaza:0xb39b73,rock:0x625746,wall:0xa89e8a,wallTop:0xd3c7aa,water:0x2c8190,wood:0x715137,leaf:0x526f3c},
      druidic:{grass:0x526b42,stone:0x7e8167,plaza:0x87906b,rock:0x4d5542,wall:0x7f8970,wallTop:0xb6b99a,water:0x2f7974,wood:0x59452f,leaf:0x3e673e},
      tundra:{grass:0x9ba9a6,stone:0xaeb5b3,plaza:0xc0c4bc,rock:0x687275,wall:0xaeb9bc,wallTop:0xdce4e1,water:0x477f96,wood:0x665849,leaf:0x55716b},
      swamp:{grass:0x59603b,stone:0x77725b,plaza:0x817355,rock:0x46483a,wall:0x737461,wallTop:0xa7a589,water:0x315f62,wood:0x51442f,leaf:0x465633},
      temple:{grass:0x77784b,stone:0xa69577,plaza:0xc0a77a,rock:0x665a49,wall:0xa99373,wallTop:0xd3c09a,water:0x347b8b,wood:0x73513a,leaf:0x536444},
      cavern:{grass:0x596064,stone:0x77757a,plaza:0x817b83,rock:0x44454b,wall:0x737078,wallTop:0xaaa5ad,water:0x2e6d7c,wood:0x55473f,leaf:0x4e5e69}
    };
    return palettes[biome]||palettes.grass;
  }
  function material(THREE,color,extra){return new THREE.MeshStandardMaterial(Object.assign({color:color,roughness:.92,metalness:0},extra||{}));}
  function addInstances(THREE,root,geometry,mat,records,transform,register,mode){
    if(!records.length)return null;
    var mesh=new THREE.InstancedMesh(geometry,mat,records.length),matrix=new THREE.Matrix4(),color=new THREE.Color();
    records.forEach(function(record,index){transform(matrix,record,index);mesh.setMatrixAt(index,matrix);if(record.tint!=null){color.set(record.tint);mesh.setColorAt(index,color);}});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    if(register)register(mesh,records.map(function(record){return {c:record.c,r:record.r};}),mode||'terrain');
    return mesh;
  }
  function worldX(plan,c){return c-plan.W/2+.5;}
  function worldZ(plan,r){return r-plan.H/2+.5;}
  function wallBlocks(plan){
    var blocks=[];
    plan.walls.forEach(function(wall){
      var rows=wall.cutaway?1:5,sideSeed=wall.side.charCodeAt(0);
      for(var row=0;row<rows;row++)for(var col=0;col<3;col++){
        if(!wall.cutaway&&row===rows-1&&(wall.c*7+wall.r*11+sideSeed+col)%7===0)continue;
        var along=(col-1)*.3+(row%2?.08:-.03),x=worldX(plan,wall.c),z=worldZ(plan,wall.r);
        if(wall.side==='n')z-=.46;if(wall.side==='s')z+=.46;if(wall.side==='e')x+=.46;if(wall.side==='w')x-=.46;
        if(wall.axis==='ns')x+=along;else z+=along;
        blocks.push({c:wall.c,r:wall.r,x:x,z:z,y:wall.y+.22+row*.29,axis:wall.axis,tint:[0xe2d8c3,0xc4b89f,0xf0e6d1,0xafa38c][Math.abs(wall.c*31+wall.r*17+row*5+col+sideSeed)%4]});
      }
    });
    return blocks;
  }
  function tagTree(tag,object,item){if(tag)tag(object,item.x,item.y,'visible-only');}
  function addProp(THREE,root,plan,item,mats,tag){
    var c=Math.round(Number(item.x)),r=Math.round(Number(item.y)),index=at({W:plan.W,H:plan.H},c,r),floor=index<0?0:(finite(item.h,0)*plan.step),kind=String(item.kind||'debris'),scale=Math.max(.55,Math.min(1.6,finite(item.scale,1))),group=new THREE.Group();
    group.position.set(worldX(plan,c),floor+.08,worldZ(plan,r));group.rotation.y=finite(item.rot,finite(item.rotation,0));root.add(group);tagTree(tag,group,item);
    function mesh(geometry,mat,x,y,z,sx,sy,sz){var value=new THREE.Mesh(geometry,mat);value.position.set(x||0,y||0,z||0);value.scale.set(sx||1,sy||1,sz||1);value.castShadow=true;value.receiveShadow=true;group.add(value);return value;}
    if(/tree|cypress|pine|snowpine|poplar|bare/.test(kind)){
      mesh(new THREE.CylinderGeometry(.09,.14,1.05,7),mats.wood,0,.52,0,scale,scale,scale);
      if(kind!=='bare')mesh(new THREE.ConeGeometry(kind==='poplar'?.24:.43,kind==='poplar'?1.35:.95,7),mats.leaf,0,1.2,0,scale,scale,scale);
    }else if(kind==='bush')mesh(new THREE.DodecahedronGeometry(.4,0),mats.leaf,0,.35,0,scale,.72*scale,scale);
    else if(kind==='column'||kind==='pillar'){
      mesh(new THREE.CylinderGeometry(.27,.34,1.45,10),mats.wallTop,0,.73,0,scale,scale,scale);
      mesh(new THREE.BoxGeometry(.68,.15,.68),mats.wall,0,.075,0,scale,scale,scale);
    }else if(kind==='rock'||kind==='boulder'||kind==='stalagmite')mesh(new THREE.DodecahedronGeometry(.38,0),mats.rock,0,.32,0,scale,.85*scale,scale);
    else if(kind==='crystalCluster'){
      [-.18,0,.17].forEach(function(x,j){mesh(new THREE.ConeGeometry(.12,.48+j*.13,5),mats.water,x,.25+j*.06,(j-1)*.08,scale,scale,scale);});
    }else if(kind==='mushroom'){
      mesh(new THREE.CylinderGeometry(.045,.065,.28,7),mats.wallTop,0,.14,0,scale,scale,scale);mesh(new THREE.ConeGeometry(.2,.18,9),mats.leaf,0,.34,0,scale,scale,scale);
    }else if(kind==='reed'||kind==='grass'){
      [-.12,0,.13].forEach(function(x,j){var blade=mesh(new THREE.CylinderGeometry(.018,.025,.48+j*.06,5),mats.leaf,x,.23,0,scale,scale,scale);blade.rotation.z=(j-1)*.17;});
    }else if(kind==='ring'){
      var ring=mesh(new THREE.TorusGeometry(.3,.055,7,18),mats.wood,0,.08,0,scale,scale,scale);ring.rotation.x=Math.PI/2;
    }else mesh(new THREE.BoxGeometry(.5,.35,.5),mats.wood,0,.18,0,scale,scale,scale);
  }

  function render(options){
    options=options||{};var THREE=options.THREE,root=options.root;
    if(!THREE||!root||typeof root.add!=='function')throw new Error('Diorama renderer needs THREE and a root group');
    var field=options.field,planValue=plan(field,options),palette=paletteFor(options.biome),register=options.registerDiscoveryInstanced,tag=options.tagDiscoveryObject;
    var mats={
      floor:{},rock:material(THREE,palette.rock),wall:material(THREE,palette.wall),wallTop:material(THREE,palette.wallTop),water:material(THREE,palette.water,{transparent:true,opacity:.78}),wood:material(THREE,palette.wood),leaf:material(THREE,palette.leaf)
    };
    mats.floor[TYPES.grass]=material(THREE,palette.grass);mats.floor[TYPES.stone]=material(THREE,palette.stone);mats.floor[TYPES.plaza]=material(THREE,palette.plaza);
    [TYPES.grass,TYPES.stone,TYPES.plaza].forEach(function(type){
      var records=planValue.floors.filter(function(cell){return cell.type===type;});
      addInstances(THREE,root,new THREE.BoxGeometry(.94,.12,.94),mats.floor[type],records,function(matrix,record){matrix.makeTranslation(worldX(planValue,record.c),record.y,worldZ(planValue,record.r));},register,'terrain');
    });
    addInstances(THREE,root,new THREE.BoxGeometry(.92,1,.92),mats.rock,planValue.volumes,function(matrix,record){
      var height=Math.max(.1,record.topY-record.bottomY);matrix.makeScale(1,height,1);matrix.setPosition(worldX(planValue,record.c),(record.topY+record.bottomY)/2-.06,worldZ(planValue,record.r));
    },register,'terrain');
    var waterMesh=addInstances(THREE,root,new THREE.BoxGeometry(.96,.05,.96),mats.water,planValue.water,function(matrix,record){matrix.makeTranslation(worldX(planValue,record.c),record.y-.05,worldZ(planValue,record.r));},register,'terrain');
    var blocks=wallBlocks(planValue);
    addInstances(THREE,root,new THREE.BoxGeometry(.28,.27,.14),mats.wallTop,blocks,function(matrix,record){matrix.makeScale(record.axis==='ew'?.5:1,1,record.axis==='ew'?2:1);matrix.setPosition(record.x,record.y,record.z);},register,'terrain');

    var gridPositions=[];
    planValue.floors.forEach(function(cell){var x=worldX(planValue,cell.c),z=worldZ(planValue,cell.r),y=cell.y+.071;gridPositions.push(x-.47,y,z-.47,x+.47,y,z-.47,x+.47,y,z-.47,x+.47,y,z+.47,x+.47,y,z+.47,x-.47,y,z+.47,x-.47,y,z+.47,x-.47,y,z-.47);});
    var gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPositions,3));
    var gridMaterial=new THREE.LineBasicMaterial({color:0x332f27,transparent:true,opacity:Math.max(0,Math.min(1,finite(options.gridOpacity,.5))),depthWrite:false});
    var gridMesh=new THREE.LineSegments(gridGeometry,gridMaterial);gridMesh.visible=gridMaterial.opacity>.001;gridMesh.renderOrder=2;root.add(gridMesh);

    planValue.props.forEach(function(item){addProp(THREE,root,planValue,item,mats,tag);});
    var span=Math.max(planValue.W,planValue.H)+8,slab=new THREE.Mesh(new THREE.BoxGeometry(span,1.5,span),material(THREE,palette.rock));slab.position.y=-.86;slab.receiveShadow=true;root.add(slab);
    var receipt={schema:SCHEMA,cells:planValue.floors.length+planValue.water.length+planValue.volumes.filter(function(value){return value.type===TYPES.rock;}).length,floorTiles:planValue.floors.length,waterTiles:planValue.water.length,raisedVolumes:planValue.volumes.length,wallEdges:planValue.walls.length,wallModules:blocks.length,props:planValue.props.length};
    return {plan:planValue,gridMesh:gridMesh,waterMeshes:waterMesh?[waterMesh]:[],receipt:receipt};
  }

  return {SCHEMA:SCHEMA,TYPES:TYPES,validateField:validateField,plan:plan,buildWallModules:wallBlocks,paletteFor:paletteFor,render:render};
});
