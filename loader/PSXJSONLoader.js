THREE.PSXJSONLoader = ( function () {
  
  var trimap = [ 0, 1, 2 ];
  var quadmap = [ 0, 1, 2, 0, 2, 3 ];
  
  function PSXJSONLoader( manager ) {
		THREE.Loader.call( this, manager );
	}
  
  PSXJSONLoader.prototype = Object.assign( Object.create( THREE.Loader.prototype ), {
    
    constructor: PSXJSONLoader,
    
    load: function ( url, onLoad, onProgress, onError, shaderData, vramContext ) {
      var scope = this;
      
      var path = ( this.path === '' ) ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;
      this.resourcePath = this.resourcePath || path
      
      var loader = new THREE.FileLoader( scope.manager );
      loader.setPath( this.path );
      loader.load( url, function ( text ) {

        var json = null;

        try {

          json = JSON.parse( text );

        } catch ( error ) {

          if ( onError !== undefined ) onError( error );

          console.error( 'THREE:PSXJSONLoader: Can\'t parse ' + url + '.', error.message );

          return;

        }

        var metadata = json.metadata;

        if ( metadata === undefined || metadata.type === undefined || metadata.type.toLowerCase() === 'geometry' ) {

          console.error( 'THREE.PSXJSONLoader: Can\'t load ' + url );
          return;

        }

        scope.parse( json, onLoad, shaderData, vramContext );

      }, onProgress, onError );
      
    },
    
    parse: function ( json, onLoad, shaderData, vramContext ) {
      var main_object = {};
      var intermediaries = [];
      var group = new THREE.Group();
      
      var unified_materials = new Map();
      // Find all material instances and create a material list
      json.data.forEach( object => {
        object.materials.forEach( s_material => {
          if( unified_materials.get(s_material.name) === undefined ){
            //console.log(`generating material ${s_material.name}`);

            
            // Get Material's texture vram position
            var vpos_args = s_material.vpos.split('x');

            s_material.vpos_val = vpos_args;


            var wmult = 1;

            if(s_material.depth === '8'){
              wmult = 2;
            }
            if(s_material.depth === '16'){
              wmult = 4;
            }

            var texture_name = s_material.texture;
            console.log('texture name: ',texture_name);

            //console.log(s_material);

            if(texture_name !== ''){
              console.log('Material Has Texture!');
              var texture = new THREE.TextureLoader().load( s_material.texture, (texture) => {
                vramContext.context.drawImage(texture.image, parseInt(vpos_args[0])*4, parseInt(vpos_args[1]), texture.image.width * wmult, texture.image.height);
                vramContext.texture.needsUpdate = true;

              } );
              var material = new THREE.ShaderMaterial( {
                uniforms: {
                  texture: { type: 't', value: vramContext.texture },
                  selected: { value: 0.0 },
                  selectedColor: { value: new THREE.Color( 0xFF8000 ) }
                },
                vertexShader: shaderData.vertexShader,
                vertexColors: THREE.VertexColors,
                fragmentShader: shaderData.fragmentShader
              } );
              var mat = {
                texture,
                material,
                src: s_material
              };
              unified_materials.set(s_material.name, mat);
            } else {
              console.log('Material Has No Texture!');
              // Gouraud Shading Only Material
              var material = new THREE.ShaderMaterial( {
                uniforms: {
                  selected: { value: 0.0 },
                  selectedColor: { value: new THREE.Color( 0xFF8000 ) }
                },
                vertexShader: shaderData.vertexShaderNoTex,
                vertexColors: THREE.VertexColors,
                fragmentShader: shaderData.fragmentShaderNoTex
              } );
              var mat = {
                material,
                src: s_material
              };
              unified_materials.set(s_material.name, mat);
            }
          }
        })
      });
      
      // Process each object separately
      json.data.forEach( ( main_object ) => {
        var object_intermediaries = [];
        var object_group = new THREE.Group();
        object_group.name = main_object.name;

        console.log("PSXLoader: obj metadata: ", main_object.metadata );
        
        // Create one mesh per material
        main_object.materials.forEach( ( mat, matidx ) => {
          var mesh_idx = [];
          var mesh_d_idx = [];
          var mesh_intermediaries = {};
          var geometry = new THREE.BufferGeometry();
          // Separate faces by material
          main_object.face_data.forEach( ( face, idx ) => {
            if( face.material === matidx ) {
              mesh_idx.push(main_object.vertex_index[idx]);
              mesh_d_idx.push(main_object.data_indices[idx]);
            }
          } );
          
          var index_data = this.generateIndices( mesh_idx );
          var vertices = this.generateUnindexedVertexBuffer( index_data.indices, main_object.vertex_data );
          var color_data = this.generateVertexColors( index_data.quad_tri_map, mesh_d_idx, main_object.color_data , main_object.metadata.halfvtxcolor );
          var uv_data = this.generateUvCoords( mesh_d_idx, main_object.uv_data, vramContext, mat );
          
          mesh_intermediaries.src_vertex_index = mesh_idx;
          mesh_intermediaries.src_data_index = mesh_d_idx;
          mesh_intermediaries.quad_tri_map = index_data.quad_tri_map;
          mesh_intermediaries.data_quad_tri_map = color_data.data_quad_tri_map;
          mesh_intermediaries.tri_count = index_data.tri_count;
          mesh_intermediaries.original_count = index_data.original_count;
          mesh_intermediaries.material = mat.name;
          
          //geometry.setIndex( index_data.indices );
          geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
          geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( color_data.colors, 3 ) );
          geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uv_data, 2 ) );
          
          var mesh = new THREE.Mesh( geometry );
          mesh.name = `${object_group.name}#${mat.name}`;
          var material_base = unified_materials.get(mat.name).material;
          mesh.material = material_base.clone();
          mesh.material.uniforms.texture = material_base.uniforms.texture;

          
          object_intermediaries.push(mesh_intermediaries);
          
          object_group.add( mesh );
        } );
        
        object_group.position.set( main_object.position.x, main_object.position.z, -main_object.position.y );
        
        object_group.rotateY( main_object.rotation.z );
        object_group.rotateZ( -main_object.rotation.y );
        object_group.rotateX( main_object.rotation.x );
        
        object_group.scale.set( main_object.scale.x, main_object.scale.z, main_object.scale.y );
        
        intermediaries.push(object_intermediaries);
        group.add(object_group);
      } );
      
      main_object.source = json;
      main_object.intermediaries = intermediaries;
      main_object.collection = group;
      main_object.materials = unified_materials;
      
      if ( onLoad !== undefined ) onLoad( main_object );
      
      return main_object;
    },
    generateIndices: function ( vertex_index ) {
      var indices = [];
      var quad_tri_map = [];
      var tri_quad_map = [];
      var tri_count = 0;
      var original_count = vertex_index.length;
      let current_tri = 0;
      vertex_index.forEach( (face, index) => {
        if( face.length === 3 ) {
          // No splitting
          face.forEach(( idx ) => indices.push( idx ));
          // Push the index for the new triangle
          quad_tri_map.push( index );
          tri_count += 1;
          tri_quad_map.push(current_tri);
          current_tri += 1;
        } else {
          // Needs splitting
          quadmap.forEach( idx => indices.push(face[idx]) )
          // Push index for the two new triangles generated
          quad_tri_map.push( index, index );
          tri_count += 2;
        }
      });
      
      return { indices, tri_quad_map, quad_tri_map, tri_count, original_count };
    },
    generateVertexBuffer: function ( vertex_data ) {
      var vertices = [];
      vertex_data.forEach( (vertex) => {
        // Swap Y-Z Axis
        vertices.push( vertex.x, vertex.z, -vertex.y );
      });
      return vertices;
    },
    generateUnindexedVertexBuffer: function ( index_data, vertex_data ) {
      var vertices = [];
      index_data.forEach( ( index ) => {
        var vertex = vertex_data[index];
        vertices.push( vertex.x, vertex.z, -vertex.y );
      });
      return vertices;
    },
    generateVertexColors: function ( quad_tri_map, data_indices, color_data, halfvtxcolor ) {
      var colors = [];
      var data_quad_tri_map = [];
      var vmult = 1.0;
      if(halfvtxcolor === "true"){
        vmult = 0.5;
      }
      data_indices.forEach( ( face, index ) => {
        if( face.length === 3 ) {
          trimap.forEach( idx => colors.push(
            color_data[face[idx]].r * vmult, color_data[face[idx]].g * vmult, color_data[face[idx]].b * vmult
          ) );
          data_quad_tri_map.push( index );
        } else {
          quadmap.forEach( idx => colors.push(
            color_data[face[idx]].r * vmult, color_data[face[idx]].g * vmult, color_data[face[idx]].b * vmult
          ) );
          data_quad_tri_map.push( index, index );
        }
      });
      return { colors, data_quad_tri_map };
    },
    generateUvCoords: function ( data_indices, uv_data, vramContext, material ) {
      var uvcoords = [];
      //console.log("UV GEN MAT", material.name);
      
      var vpos_args = material.vpos.split('x');
      vpos_args[0] = (parseInt(vpos_args[0]) * 4) / vramContext.vwidth;
      vpos_args[1] = parseInt(vpos_args[1]) / vramContext.height;

      var tex_width = material.twidth;
      var tex_height = material.theight;

      var umult = 1;
      if(material.depth === '8'){
        umult = 2;
      }
      if(material.depth === '16'){
        umult = 4;
      }

      data_indices.forEach( ( face, index ) => {
        if( face.length === 3 ) {
          trimap.forEach( idx => {
            let face_uv_u0 = (Math.floor(uv_data[face[idx]].u * tex_width) / (4096.0 / umult));
            let face_uv_v0 = (1.0 - ((Math.ceil((1.0 - uv_data[face[idx]].v) * tex_height)) / vramContext.height));
            //console.log(uv_data[face[idx]].u);
            uvcoords.push( vpos_args[0] + face_uv_u0 + (0.5/(4096.0 / umult)), vpos_args[1] + face_uv_v0  + (0.5 / 512.0));
          });
        } else {
          
          quadmap.forEach( idx => {
            let face_uv_u1 = Math.floor(uv_data[face[idx]].u * tex_width) / (4096.0 / umult);
            let face_uv_v1 =  1.0 - ((Math.ceil((1.0 - uv_data[face[idx]].v) * tex_height)) / vramContext.height);
            uvcoords.push( vpos_args[0] + face_uv_u1 +  (0.5/(4096.0 / umult)), vpos_args[1] + face_uv_v1  + (0.5 / 512.0));
          });
        }
      });
      return uvcoords;
    }

  });
  
  return PSXJSONLoader;
})();