/* ============================================================
   Dexatron Admin dashboard, Supabase edition
   Login now goes through Supabase Auth for real (email + password
   checked server-side by Supabase, not compared in this file).
   Uploads go to real Supabase Storage and the content table, so
   they're visible to any visitor, on any device.
   ============================================================ */

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

function showDashboard(){
  loginScreen.hidden = true;
  dashboard.hidden = false;
  loadList();
}
function showLogin(){
  loginScreen.hidden = false;
  dashboard.hidden = true;
}

/* Check for an existing Supabase session on page load (stays logged
   in across refreshes until you explicitly log out). */
DexatronStore.client.auth.getSession().then(({ data }) => {
  if (data.session) showDashboard();
  else showLogin();
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  loginError.classList.remove('show');

  const { error } = await DexatronStore.client.auth.signInWithPassword({ email, password });
  if (error){
    loginError.textContent = error.message || 'Incorrect email or password.';
    loginError.classList.add('show');
  } else {
    showDashboard();
  }
});

logoutBtn.addEventListener('click', async () => {
  await DexatronStore.client.auth.signOut();
  showLogin();
});

/* ---------- content form ---------- */
const contentForm = document.getElementById('contentForm');
const dropzone = document.getElementById('dropzone');
const dropzoneText = document.getElementById('dropzoneText');
const fileInput = document.getElementById('fileInput');
const uploadPreview = document.getElementById('uploadPreview');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const editingIdField = document.getElementById('editingId');

const fieldTitle = document.getElementById('fieldTitle');
const fieldDescription = document.getElementById('fieldDescription');
const fieldCategory = document.getElementById('fieldCategory');
const fieldDate = document.getElementById('fieldDate');
const fieldFeatured = document.getElementById('fieldFeatured');
const fieldPublished = document.getElementById('fieldPublished');

let pendingFile = null;
let pendingThumbBlob = null;

fieldDate.valueAsDate = new Date();

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

async function handleFile(file){
  pendingFile = file;
  uploadPreview.innerHTML = '';
  const url = URL.createObjectURL(file);
  let node;
  if (file.type.startsWith('video/')){
    node = document.createElement('video');
    node.src = url;
    node.controls = true;
    pendingThumbBlob = await DexatronStore.videoThumbnail(file);
  } else {
    node = document.createElement('img');
    node.src = url;
    pendingThumbBlob = null; // images use themselves as the thumbnail, no separate upload needed
  }
  uploadPreview.appendChild(node);
  dropzoneText.textContent = file.name;
  checkFormReady();
}

function checkFormReady(){
  const editing = !!editingIdField.value;
  submitBtn.disabled = !(fieldTitle.value.trim() && (pendingFile || editing));
}
[fieldTitle].forEach(el => el.addEventListener('input', checkFormReady));

contentForm.addEventListener('submit', async e => {
  e.preventDefault();
  const editingId = editingIdField.value;
  submitBtn.disabled = true;
  submitBtn.textContent = editingId ? 'Saving...' : 'Publishing...';

  const base = {
    title: fieldTitle.value.trim(),
    description: fieldDescription.value.trim(),
    category: fieldCategory.value,
    date: fieldDate.value,
    featured: fieldFeatured.checked,
    published: fieldPublished.checked,
  };

  try{
    if (editingId){
      const changes = { ...base };
      if (pendingFile){
        changes.mediaFile = pendingFile;
        changes.mediaType = pendingFile.type.startsWith('video/') ? 'video' : 'image';
        changes.thumbFile = pendingThumbBlob;
      }
      await DexatronStore.update(editingId, changes);
      showToast('Content updated');
    } else {
      await DexatronStore.add({
        ...base,
        mediaFile: pendingFile,
        mediaType: pendingFile.type.startsWith('video/') ? 'video' : 'image',
        thumbFile: pendingThumbBlob,
      });
      showToast('Published to the Feed');
    }
    resetForm();
    loadList();
  } catch(err){
    console.error(err);
    showToast(err.message || 'Something went wrong saving that.');
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? 'Save changes' : 'Publish';
  }
});

cancelEditBtn.addEventListener('click', resetForm);

function resetForm(){
  contentForm.reset();
  fieldDate.valueAsDate = new Date();
  editingIdField.value = '';
  pendingFile = null;
  pendingThumbBlob = null;
  uploadPreview.innerHTML = '';
  dropzoneText.textContent = 'Drag a file here, or click to choose one';
  formTitle.textContent = 'Publish new content';
  submitBtn.textContent = 'Publish';
  cancelEditBtn.hidden = true;
  fieldPublished.checked = true;
  checkFormReady();
}

/* ---------- content list ---------- */
const adminList = document.getElementById('adminList');

async function loadList(){
  let items = [];
  try{
    items = await DexatronStore.getAll();
  } catch(err){
    console.error(err);
    showToast('Could not load content list');
    return;
  }
  adminList.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    const thumbUrl = item.thumb_url || item.media_url;
    const dateLabel = item.date ? new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '';
    row.innerHTML = `
      <div class="admin-row-thumb"><img src="${thumbUrl}" alt="" loading="lazy"></div>
      <div class="admin-row-info">
        <h4>${escapeHtml(item.title)}</h4>
        <div class="admin-row-meta">
          <span>${escapeHtml(item.category || '')}</span>
          <span>${dateLabel}</span>
          <span class="status-pill ${item.published ? 'published' : 'draft'}">${item.published ? 'Published' : 'Draft'}</span>
          ${item.featured ? '<span class="status-pill featured">Featured</span>' : ''}
        </div>
      </div>
      <div class="admin-row-actions">
        <button class="icon-btn" title="Edit" data-action="edit" data-id="${item.id}">&#9998;</button>
        <button class="icon-btn" title="${item.published ? 'Unpublish' : 'Publish'}" data-action="toggle" data-id="${item.id}">${item.published ? '&#128065;' : '&#128683;'}</button>
        <button class="icon-btn danger" title="Delete" data-action="delete" data-id="${item.id}">&#128465;</button>
      </div>`;
    adminList.appendChild(row);
  });
}

adminList.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete'){
    if (!confirm('Delete this content? This can\'t be undone.')) return;
    try{
      await DexatronStore.remove(id);
      showToast('Deleted');
      loadList();
    } catch(err){
      console.error(err);
      showToast('Could not delete that.');
    }
    return;
  }

  if (action === 'toggle'){
    const items = await DexatronStore.getAll();
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return;
    await DexatronStore.update(id, { published: !item.published });
    loadList();
    return;
  }

  if (action === 'edit'){
    const items = await DexatronStore.getAll();
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return;
    editingIdField.value = item.id;
    fieldTitle.value = item.title;
    fieldDescription.value = item.description || '';
    fieldCategory.value = item.category || 'Comic';
    fieldDate.value = item.date || '';
    fieldFeatured.checked = !!item.featured;
    fieldPublished.checked = !!item.published;
    uploadPreview.innerHTML = '';
    const node = item.media_type === 'video' ? document.createElement('video') : document.createElement('img');
    node.src = item.media_url;
    if (item.media_type === 'video') node.controls = true;
    uploadPreview.appendChild(node);
    dropzoneText.textContent = 'Editing existing file, choose a new one to replace it';
    pendingFile = null;
    pendingThumbBlob = null;
    formTitle.textContent = 'Edit content';
    submitBtn.textContent = 'Save changes';
    cancelEditBtn.hidden = false;
    checkFormReady();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(msg){
  let toast = document.querySelector('.toast');
  if (!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}
