//

THREE.PSXJSONLoader = ( function () {
  
  function PSXJSONLoader( manager ) {
		THREE.Loader.call( this, manager );
	}
  
  PSXJSONLoader.prototype = Object.assign( Object.create( THREE.Loader.prototype ), {
    
    constructor: PSXJSONLoader,
    
    load: function ( url, onLoad, onProgress, onError ) {
      //console.log(vertexShader);
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

        scope.parse( json, onLoad );

      }, onProgress, onError );
      
    },
    
    parse: function ( json, onLoad ) {
      var object = {};
      var intermediaries = [];
      var group = new THREE.Group();
      
      
      // Process each object separately
      json.data.forEach(( object ) => {
        //var object = new THREE.Object();
        var mesh;
        var inter_data = {};
        
        var geometry = new THREE.BufferGeometry();
             
        var material = new THREE.MeshBasicMaterial( {
					//side: THREE.DoubleSide,
					vertexColors: THREE.VertexColors
          //color: 0x00ff00
				} );
        
        var index_data = this.generateIndices( object.vertex_index );
        
        var vertices = this.generateUnindexedVertexBuffer( index_data.indices, object.vertex_data );
        
        var color_data = this.generateVertexColors( index_data.quad_tri_map, object.data_indices, object.color_data );
        
        var uv_data = this.generateUvCoords( object.data_indices, object.uv_data );
        
        inter_data.quad_tri_map = index_data.quad_tri_map;
        inter_data.data_quad_tri_map = color_data.data_quad_tri_map;
        inter_data.tri_count = index_data.tri_count;
        inter_data.original_count = index_data.original_count;
  
        //geometry.setIndex( index_data.indices );
        geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( color_data.colors, 3 ) );
        geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uv_data, 2 ) );
        
        mesh = new THREE.Mesh( geometry );
        mesh.name = object.name;
        mesh.material = material;
        mesh.translateX( object.position.x );
        mesh.translateY( object.position.z );
        mesh.translateZ( -object.position.y );
        
        mesh.rotateY( object.rotation.z );
        mesh.rotateZ( -object.rotation.y );
        mesh.rotateX( object.rotation.x );
        
        mesh.scale.set( object.scale.x, object.scale.z, object.scale.y );
        
        group.add( mesh );
        intermediaries.push( inter_data );
      });
      
      object.source = json;
      object.intermediaries = intermediaries;
      object.collection = group;
      
      if ( onLoad !== undefined ) onLoad( object );
      
      return object;
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
          indices.push(
            face[0], face[1], face[2],
            face[0], face[2], face[3]
          );
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
    generateVertexColors: function ( quad_tri_map, data_indices, color_data ) {
      var colors = [];
      var data_quad_tri_map = [];
      data_indices.forEach( ( face, index ) => {
      if( face.length === 3 ) {
        colors.push( color_data[face[0]].r, color_data[face[0]].g, color_data[face[0]].b );
        colors.push( color_data[face[1]].r, color_data[face[1]].g, color_data[face[1]].b );
        colors.push( color_data[face[2]].r, color_data[face[2]].g, color_data[face[2]].b );
        data_quad_tri_map.push( index );
      } else {
        colors.push( color_data[face[0]].r, color_data[face[0]].g, color_data[face[0]].b );
        colors.push( color_data[face[1]].r, color_data[face[1]].g, color_data[face[1]].b );
        colors.push( color_data[face[2]].r, color_data[face[2]].g, color_data[face[2]].b );

        colors.push( color_data[face[0]].r, color_data[face[0]].g, color_data[face[0]].b );
        colors.push( color_data[face[2]].r, color_data[face[2]].g, color_data[face[2]].b );
        colors.push( color_data[face[3]].r, color_data[face[3]].g, color_data[face[3]].b );
      data_quad_tri_map.push( index, index );
      }
      });
      return { colors, data_quad_tri_map };
    },
    generateUvCoords: function ( data_indices, uv_data ) {
      var uvcoords = [];
      data_indices.forEach( ( face, index ) => {
      if( face.length === 3 ) {
        uvcoords.push( uv_data[face[0]].u, uv_data[face[0]].v );
        uvcoords.push( uv_data[face[1]].u, uv_data[face[1]].v );
        uvcoords.push( uv_data[face[2]].u, uv_data[face[2]].v );
      } else {
        uvcoords.push( uv_data[face[0]].u, uv_data[face[0]].v );
        uvcoords.push( uv_data[face[1]].u, uv_data[face[1]].v );
        uvcoords.push( uv_data[face[2]].u, uv_data[face[2]].v );

        uvcoords.push( uv_data[face[0]].u, uv_data[face[0]].v );
        uvcoords.push( uv_data[face[2]].u, uv_data[face[2]].v );
        uvcoords.push( uv_data[face[3]].u, uv_data[face[3]].v );
      }
      });
      return uvcoords;
    }
    
  });
  
  return PSXJSONLoader;
})();