/* director.html — 背景图 & 3D 模型上传 */
/* 依赖：Three.js r152（已通过 CDN 引入 GLTFLoader / OBJLoader） */

/* ========== 上传背景图 ========== */
function uploadBgImage() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            new THREE.TextureLoader().load(e.target.result, function (tex) {
                scene.background = tex;
                showToast('背景图已设置: ' + file.name);
            }, undefined, function () {
                showToast('背景图加载失败');
            });
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

/* ========== 上传 3D 模型 ========== */
function uploadModel() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,.obj,.OBJ';
    input.onchange = function () {
        var file = input.files[0];
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();
        var url = URL.createObjectURL(file);

        /* — GLB / GLTF — */
        if (ext === 'glb' || ext === 'gltf') {
            if (typeof THREE.GLTFLoader === 'undefined') {
                showToast('GLTFLoader 未加载，请刷新页面');
                return;
            }
            new THREE.GLTFLoader().load(url, function (gltf) {
                var model = gltf.scene;
                model.name = file.name.replace(/\.[^.]+$/, '') || '模型_' + (objects.length + 1);
                scene.add(model);
                objects.push(model);
                selectObject(model);
                renderObjectTree();
                showToast('模型已加载: ' + file.name);
            }, undefined, function (err) {
                showToast('模型加载失败: ' + (err && err.message || '未知错误'));
            });
            return;
        }

        /* — OBJ — */
        if (ext === 'obj') {
            if (typeof THREE.OBJLoader === 'undefined') {
                showToast('OBJLoader 未加载，请刷新页面');
                return;
            }
            new THREE.OBJLoader().load(url, function (model) {
                model.name = file.name.replace(/\.[^.]+$/, '') || '模型_' + (objects.length + 1);
                scene.add(model);
                objects.push(model);
                selectObject(model);
                renderObjectTree();
                showToast('模型已加载: ' + file.name);
            }, undefined, function (err) {
                showToast('OBJ 加载失败: ' + (err && err.message || '未知错误'));
            });
            return;
        }

        showToast('不支持的文件格式: ' + ext);
    };
    input.click();
}
