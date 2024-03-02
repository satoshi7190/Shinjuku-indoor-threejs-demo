import './style.css';

import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshLine, MeshLineMaterial } from 'three.meshline';

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

// キャンバスの作成
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

// シーンの作成
const scene = new THREE.Scene();

// カメラ
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100000);
camera.position.set(-190, 280, -350);
scene.add(camera);

// コントロール
const mapControls = new MapControls(camera, canvas);
mapControls.enableDamping = true;
mapControls.enableZoom = false;
mapControls.maxDistance = 1000;

const zoomControls = new TrackballControls(camera, canvas);
zoomControls.noPan = true;
zoomControls.noRotate = true;
zoomControls.noZoom = false;
zoomControls.zoomSpeed = 0.5;

// レンダラー
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 画面リサイズ時にキャンバスもリサイズ
const onResize = () => {
    // サイズを取得
    const width = window.innerWidth;
    const height = window.innerHeight;

    // レンダラーのサイズを調整する
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    // カメラのアスペクト比を正す
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
};
window.addEventListener('resize', onResize);

// dat.GUIのインスタンスを作成
const gui = new GUI({ width: 150 });

// 画面サイズに応じてGUIを折りたたむ
if (window.innerWidth < 768) {
    // 768pxをしきい値とする例
    gui.close();
}

// グループの作成
const groupList = [4, 3, 2, 1, 0, -1, -2, -3];
const layers = ['4F', '3F', '2F', '1F', '0', 'B1', 'B2', 'B3'];

groupList.forEach((num, i) => {
    const group = new THREE.Group();
    group.name = `group${num}`;
    scene.add(group);
    const key = `group${num}`;

    // GUIにチェックボックスを追加
    gui.add(
        {
            [key]: true,
        },
        key,
    )
        .onChange((isVisible) => {
            scene.getObjectByName(key).visible = isVisible;
        })
        .name(layers[i]);
});

// FileLoaderをインスタンス化。JSON形式でデータを取得する
const loader = new THREE.FileLoader().setResponseType('json');

// シーンの中心にする地理座標(EPSG:6677)
const center = [-12035.29, -34261.85];

// 正規表現を用いて階層番号を取得
const getFloorNumber = (geojson, type) => {
    const regex = new RegExp(`ShinjukuTerminal_([-B\\d]+)(out)?_${type}`);
    const match = geojson.match(regex);
    if (!match) return null;

    let floor = match[1].replace('B', '-');
    return parseInt(match[2] === 'out' ? floor.replace('out', '') : floor, 10);
};

// ポリゴンからExtrudeGeometryを返す関数
const createExtrudedGeometry = (coordinates, depth) => {
    const shape = new THREE.Shape();

    // ポリゴンの座標からShapeを作成
    coordinates[0].forEach((point, index) => {
        const [x, y] = point.map((coord, idx) => coord - center[idx]);
        if (index === 0) {
            // 最初の点のみmoveTo
            shape.moveTo(x, y);
        } else if (index + 1 === coordinates[0].length) {
            // 最後の点のみclosePathで閉じる
            shape.closePath();
        } else {
            // それ以外はlineTo
            shape.lineTo(x, y);
        }
    });
    return new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth: depth,
        bevelEnabled: false,
    });
};

// 階ごとに離すY軸方向の距離
const verticalOffset = 30;

// ファイルを読み込んで、シーンに追加。geometryの情報がないものは除外
const loadAndAddToScene = (geojson, floorNumber, depth) => {
    loader.load(geojson, (data) => {
        // Lineのマテリアル
        const lineMaterial = new THREE.LineBasicMaterial({ color: 'rgb(255, 255, 255)' });

        // geometryの情報がないものは除外
        data.features
            .filter((feature) => feature.geometry)
            .forEach((feature) => {
                // ExtrudeGeometryを作成
                const geometry = createExtrudedGeometry(feature.geometry.coordinates, depth);

                // 90度回転させる
                const matrix = new THREE.Matrix4().makeRotationX(Math.PI / -2);
                geometry.applyMatrix4(matrix);

                // ExtrudeGeometryからLineを作成
                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, lineMaterial);
                line.position.y += floorNumber * verticalOffset - 1;

                // Groupに追加
                const group = scene.getObjectByName(`group${floorNumber}`);
                group.add(line);
            });
    });
};

// Spaceの配列
const SpaceLists = [
    './ShinjukuTerminal/ShinjukuTerminal_B3_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B2_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B1_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_0_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_1_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2out_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3out_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4_Space.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4out_Space.geojson',
];

// Spaceの読み込み
SpaceLists.forEach((geojson) => {
    const floorNumber = getFloorNumber(geojson, 'Space');
    if (floorNumber !== null) {
        loadAndAddToScene(geojson, floorNumber, 5);
    }
});

// Floorの配列
const FloorLists = [
    './ShinjukuTerminal/ShinjukuTerminal_B3_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B2_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B1_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_0_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_1_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2out_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3out_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4_Floor.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4out_Floor.geojson',
];

// Floorの読み込み
FloorLists.forEach((geojson) => {
    const floorNumber = getFloorNumber(geojson, 'Floor');
    if (floorNumber !== null) {
        loadAndAddToScene(geojson, floorNumber, 0.5);
    }
});

// Fixtureの配列
const FixtureLists = [
    './ShinjukuTerminal/ShinjukuTerminal_B3_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B2_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_B1_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_0_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_2out_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_3out_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4_Fixture.geojson',
    './ShinjukuTerminal/ShinjukuTerminal_4out_Fixture.geojson',
];

// Fixtureの読み込み
FixtureLists.forEach((geojson) => {
    const floorNumber = getFloorNumber(geojson, 'Fixture');
    if (floorNumber !== null) {
        loadAndAddToScene(geojson, floorNumber, 5);
    }
});

const linkMaterial = new MeshLineMaterial({
    transparent: true,
    lineWidth: 1,
    color: new THREE.Color('rgb(0, 255, 255)'),
});

// Shaderを追加
linkMaterial.onBeforeCompile = (shader) => {
    // userDataにuniformsを追加
    Object.assign(shader.uniforms, linkMaterial.userData.uniforms);

    const keyword2 = 'void main() {';
    shader.vertexShader = shader.vertexShader.replace(
        keyword2,
        /* GLSL */ `
        varying vec2 vUv;
        attribute float uDistance;
        attribute float uDirection;
        varying float vDistance;
        varying float vDirection;
        ${keyword2}`,
    );

    // 置換してシェーダーに追記する
    const keyword3 = 'vUV = uv;';
    shader.vertexShader = shader.vertexShader.replace(
        keyword3,
        /* GLSL */ `
        ${keyword3}
        vUv = uv;
        vDistance = uDistance;
        vDirection = uDirection;
        `,
    );

    const keyword1 = 'void main() {';
    shader.fragmentShader = shader.fragmentShader.replace(
        keyword1,
        /* GLSL */ `
        uniform float uTime;
        varying float vDirection;
        varying float vDistance;
        varying vec2 vUv;
        ${keyword1}`,
    );
    // 置換してシェーダーに追記する
    const keyword = 'gl_FragColor.a *= step(vCounters, visibility);';
    shader.fragmentShader = shader.fragmentShader.replace(
        keyword,
        /* GLSL */ `${keyword}
        vec2 p;
        p.x = vUv.x * vDistance;
        p.y = vUv.y * 1.0 - 0.5;

        float centerDistY = p.y; // 中心からのY距離
        float offset = abs(centerDistY) * 0.5; // 斜めの強さを制御

        float time = uTime;
        // 中心より上と下で斜めの方向を変える
        if(centerDistY < 0.0) {
            if(vDirection == 1.0){
                time = -uTime;
                offset = -offset;
            }else if(vDirection == 2.0) {
                offset = offset;
            }
        }

        // mod関数と中心からのy距離に基づくオフセットを使用して線を生成
        float line = mod(p.x - time + offset, 1.9) < 0.9 ? 1.0 : 0.0;
        vec3 mainColor;

        // 方向によって色を変える
        if(vDirection == 1.0) {
            mainColor = vec3(0.0, 1.0, 1.0);
        } else if(vDirection == 2.0) {
            mainColor = vec3(1.0, 1.0, 0.0);
        }
        vec3 color = mix(mainColor, mainColor, line);

        gl_FragColor = vec4(color, line * 0.7);
        `,
    );
};

// メッシュラインの配列
const meshLines = [];

// 歩行者ネットワークの作成
const creatingLink = (nodeId) => {
    loader.load('./nw/Shinjuku_link.geojson', (data) => {
        data.features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates;

            // ノードデータからstart_idとend_idの取得
            const start_id = nodeId.find((node) => node.node_id === feature.properties.start_id);
            const end_id = nodeId.find((node) => node.node_id === feature.properties.end_id);

            // 3次元のpointの配列を作成
            const points = coordinates.map((point, index) => {
                let y;

                if (!start_id && !end_id) {
                    // start_idとend_idがない場合は、0階層に配置
                    y = 0;
                } else if (start_id && !end_id) {
                    // start_idのみある場合は、start_idの階層に配置
                    y = start_id.ordinal;
                } else if (!start_id && end_id) {
                    // end_idのみある場合は、end_idの階層に配置
                    y = end_id.ordinal;
                } else {
                    // start_idとend_idがある場合
                    if (index === 0) {
                        // 最初の点の場合はstart_idの階層に配置
                        y = start_id.ordinal;
                    } else if (index === coordinates.length - 1) {
                        // 最後の点の場合はend_idの階層に配置
                        y = end_id.ordinal;
                    } else if (start_id.ordinal === end_id.ordinal) {
                        // start_idとend_idの階層が同じ場合は、その階層に配置
                        y = end_id.ordinal;
                    } else {
                        // start_idとend_idの階層が異なる場合は、中間の階層に配置
                        y = Math.round((start_id.ordinal + end_id.ordinal) / 2);
                    }
                }
                return new THREE.Vector3(point[0] - center[0], y * verticalOffset + 1, -(point[1] - center[1]));
            });

            // pointの配列からMeshLineを作成
            points.forEach((point, index) => {
                // 最後の点の場合は処理を終了
                if (index + 1 === points.length) return;

                // MeshLineを作成。2点間のMeshLineを別々に作成する
                const geometry = new THREE.BufferGeometry().setFromPoints([point, points[index + 1]]);
                const line = new MeshLine();
                line.setGeometry(geometry);

                // 2点間の距離を計算
                const distance = point.distanceTo(points[index + 1]);

                // MeshLineの頂点数を取得
                const numVerticesAfter = line.geometry.getAttribute('position').count;

                // 頂点数に基づいて distances 配列を生成しsetAttributeで頂点属性を追加。UV座標のアスペクト比の計算に使用
                const distances = new Float32Array(numVerticesAfter).fill(distance);
                line.setAttribute('uDistance', new THREE.BufferAttribute(distances, 1));

                // 頂点数に基づいて directions 配列を生成しsetAttributeで頂点属性を追加。リンクデータの方向を表す
                const directions = new Float32Array(numVerticesAfter).fill(feature.properties.direction);
                line.setAttribute('uDirection', new THREE.BufferAttribute(directions, 1));

                // uniforms変数にuTime（時間）を追加。アニメーションに使用
                Object.assign(linkMaterial.userData, {
                    uniforms: {
                        uTime: { value: 0 },
                    },
                });

                // MeshLineの配列に追加
                const mesh = new THREE.Mesh(line, linkMaterial);
                meshLines.push(mesh.geometry);
            });
        });

        // MeshLineをマージ
        const linkGeometry = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(meshLines), linkMaterial);
        linkGeometry.name = 'link';

        // シーンに追加
        scene.add(linkGeometry);

        // 読み込み完了後にローディング画面を非表示にする
        const loading = document.getElementById('loading');

        const animation = loading.animate(
            {
                opacity: [1, 0],
            },
            {
                duration: 300,
                fill: 'forwards',
            },
        );

        animation.onfinish = () => {
            loading.remove();
        };
    });
};

gui.add(
    {
        hasCheck: true,
    },
    'hasCheck',
)
    .onChange((isV) => {
        scene.getObjectByName('link').visible = isV;
    })
    .name('歩行者ネットワーク');

// ノードデータからnode_idと階層（ordinal）を取得
loader.load('./nw/Shinjuku_node.geojson', (data) => {
    const nodeIds = data.features.map((feature) => {
        return {
            node_id: feature.properties.node_id,
            ordinal: feature.properties.ordinal,
        };
    });

    // 歩行者ネットワークの作成
    creatingLink(nodeIds);
});

// 基盤地図情報道路データの読み込み;
loader.load('./fg.geojson', (data) => {
    const material = new THREE.LineBasicMaterial({
        color: new THREE.Color('rgb(209, 102, 255)'),
    });
    data.features.forEach((feature) => {
        const coordinates = feature.geometry.coordinates;
        const points = coordinates[0].map((point) => {
            return new THREE.Vector3(point[0] - center[0], point[1] - center[1], 0);
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const matrix = new THREE.Matrix4().makeRotationX(Math.PI / -2);
        geometry.applyMatrix4(matrix);

        const line = new THREE.Line(geometry, material);
        scene.getObjectByName(`group0`).add(line);
    });
});

// アニメーション
const animate = () => {
    requestAnimationFrame(animate);

    const target = mapControls.target;
    mapControls.update();
    zoomControls.target.set(target.x, target.y, target.z);
    zoomControls.update();

    // 歩行者ネットワークのアニメーション
    if (linkMaterial.uniforms.uTime) {
        linkMaterial.uniforms.uTime.value += 0.1;
    }

    renderer.render(scene, camera);
};
animate();
