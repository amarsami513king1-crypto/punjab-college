(() => {
  'use strict';

  const STORAGE_KEY = 'pnc.studentResults.v1';
  const PASS_PERCENTAGE_KEY = 'pnc.passPercentage.v1';
  const SUBJECTS = [
    { key: 'english', label: 'English' },
    { key: 'urdu', label: 'Urdu' },
    { key: 'subjectThree', label: 'Biology / Mathematics / Psychology' },
    { key: 'subjectFour', label: 'Computer / Chemistry / Statistics' },
    { key: 'subjectFive', label: 'Physics / Civics' },
    { key: 'quran', label: 'T.Q. (Tarjuma-tul-Quran)' },
    { key: 'islamiat', label: 'Islamiat' }
  ];

  document.querySelectorAll('[data-current-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  function readResults() {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return [];
    const records = JSON.parse(serialized);
    if (!Array.isArray(records)) throw new Error('Saved result data is not in the expected format.');
    return records;
  }

  function writeResults(records) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function normalizeRoll(rollNumber) {
    return rollNumber.trim().toLocaleLowerCase();
  }

  function getPassingPercentage() {
    const stored = window.localStorage.getItem(PASS_PERCENTAGE_KEY);
    if (stored === null) return 33;
    const percentage = Number(stored);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error('Saved passing percentage must be between 0 and 100.');
    }
    return percentage;
  }

  function readSubjectMarks(marks, key) {
    const value = marks?.[key];
    if (value && typeof value === 'object') {
      return {
        total: value.total === '' || value.total === undefined ? null : value.total,
        obtained: value.obtained === '' || value.obtained === undefined ? null : value.obtained
      };
    }
    if (value !== null && value !== undefined && value !== '') {
      return { total: null, obtained: value };
    }
    return { total: null, obtained: null };
  }

  function calculateSummary(totalValue, obtainedValue, marks, passPercentage = getPassingPercentage()) {
    const hasTotal = totalValue !== null && totalValue !== undefined && totalValue !== '';
    const hasObtained = obtainedValue !== null && obtainedValue !== undefined && obtainedValue !== '';
    const total = hasTotal ? Number(totalValue) : null;
    const obtained = hasObtained ? Number(obtainedValue) : null;
    const subjects = SUBJECTS.map((subject) => ({
      ...subject,
      ...readSubjectMarks(marks, subject.key)
    }));
    const incompleteSubject = subjects.some((subject) =>
      (subject.total === null) !== (subject.obtained === null)
    );
    const entered = subjects.filter((subject) => subject.total !== null && subject.obtained !== null);
    const percentage = total !== null && obtained !== null && total > 0
      ? (obtained / total) * 100
      : null;
    const subjectInvalid = entered.some((subject) => Number(subject.total) <= 0 || Number(subject.obtained) > Number(subject.total));
    const subjectFailed = entered.some((subject) => (Number(subject.obtained) / Number(subject.total)) * 100 < passPercentage);
    const status = percentage === null || incompleteSubject || subjectInvalid
      ? 'Pending'
      : subjectFailed || obtained > total || percentage < passPercentage
        ? 'Fail'
        : 'Pass';
    return { total, obtained, percentage, status, subjects };
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  }

  function statusClass(status) {
    return status === 'Pass' ? 'status-pass' : status === 'Fail' ? 'status-fail' : 'status-pending';
  }

  function setMessage(element, text, isError = true) {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('message-success', !isError && Boolean(text));
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function renderMarksheet(record, container) {
    const summary = typeof record.totalMarks === 'undefined' || typeof record.obtainedMarks === 'undefined'
      ? { total: null, obtained: null, percentage: null, status: 'Pending' }
      : calculateSummary(record.totalMarks, record.obtainedMarks, record.marks);
    const hasLegacySubjectMarks = SUBJECTS.some(({ key }) => typeof record.marks?.[key] === 'number');
    if (hasLegacySubjectMarks && record.resultStatus) summary.status = record.resultStatus;
    const subjectRows = SUBJECTS.map((subject) => {
      const marks = readSubjectMarks(record.marks, subject.key);
      return `<tr><td>${escapeHTML(subject.label)}</td><td>${marks.total === null ? '' : escapeHTML(formatNumber(Number(marks.total)))}</td><td>${marks.obtained === null ? '' : escapeHTML(formatNumber(Number(marks.obtained)))}</td></tr>`;
    }).join('');
    const detail = (label, value) => `<div class="detail-item"><span>${label}</span><strong>${escapeHTML(value || '—')}</strong></div>`;
    container.innerHTML = `
      <div class="marksheet-head">
        <div class="marksheet-brand">
          <img class="brand-mark" src="assets/college-logo.png" alt="">
          <div><h2>Punjab NastonAL College</h2><p>Peshawar Chapter</p></div>
        </div>
        <span class="marksheet-label">OFFICIAL MARKSHEET</span>
      </div>
      <h2 class="marksheet-title">STUDENT RESULT</h2>
      <div class="student-details">
        ${detail('Name', record.name)}
        ${detail('Father Name', record.fatherName)}
        ${detail('Roll Number', record.rollNumber)}
        ${detail('Class', record.className)}
        ${detail('Section', record.section)}
        ${detail('Date', record.date)}
      </div>
      <table class="marks-table">
        <thead><tr><th>Subject</th><th>Total Marks</th><th>Obtained Marks</th></tr></thead>
        <tbody>${subjectRows}</tbody>
      </table>
      <div class="marksheet-summary">
        <div class="marksheet-stat"><span>Total Marks</span><strong>${summary.total === null ? '' : formatNumber(summary.total)}</strong></div>
        <div class="marksheet-stat"><span>Obtained Marks</span><strong>${summary.obtained === null ? '' : formatNumber(summary.obtained)}</strong></div>
        <div class="marksheet-stat"><span>Percentage</span><strong>${summary.percentage === null ? '' : `${formatNumber(summary.percentage)}%`}</strong></div>
        <div class="marksheet-stat"><span>Result Status</span><strong><span class="status-pill ${statusClass(summary.status)}">${summary.status}</span></strong></div>
      </div>
      ${record.remarks ? `<p class="marksheet-remarks"><strong>Remarks:</strong> ${escapeHTML(record.remarks)}</p>` : ''}
      <div class="marksheet-actions"><button type="button" class="button button-primary" data-print-result>Print Result <span aria-hidden="true">⎙</span></button></div>`;
    container.querySelector('[data-print-result]')?.addEventListener('click', () => window.print());
  }

  const page = document.body.dataset.page;
  if (page === 'results') {
    const trigger = document.querySelector('.menu-trigger');
    const menu = document.querySelector('#access-menu');
    trigger?.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (menu) menu.hidden = expanded;
    });
    document.addEventListener('click', (event) => {
      if (menu && trigger && !menu.hidden && !trigger.contains(event.target) && !menu.contains(event.target)) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu && trigger) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    const searchForm = document.querySelector('#result-search');
    const searchMessage = document.querySelector('#search-message');
    const marksheet = document.querySelector('#marksheet');
    const emptyState = document.querySelector('#empty-state');
    searchForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      setMessage(searchMessage, '');
      try {
        const rollNumber = new FormData(searchForm).get('rollNumber');
        const record = readResults().find((item) => normalizeRoll(item.rollNumber) === normalizeRoll(String(rollNumber)));
        if (!record) {
          marksheet.hidden = true;
          emptyState.hidden = false;
          setMessage(searchMessage, 'No result was found for that roll number.');
          return;
        }
        renderMarksheet(record, marksheet);
        marksheet.hidden = false;
        emptyState.hidden = true;
        marksheet.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        setMessage(searchMessage, `Unable to read saved results: ${error.message}`);
      }
    });
  }

  if (page === 'login') {
    if (sessionStorage.getItem('pnc.adminAuthenticated') === 'true') {
      window.location.replace('admin.html');
      return;
    }
    const loginForm = document.querySelector('#login-form');
    const loginMessage = document.querySelector('#login-message');
    loginForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const username = String(formData.get('username') || '').trim();
      const password = String(formData.get('password') || '');
      if (username === 'fahadm123' && password === '32323') {
        sessionStorage.setItem('pnc.adminAuthenticated', 'true');
        window.location.href = 'admin.html';
        return;
      }
      setMessage(loginMessage, 'The username or password is incorrect.');
      document.querySelector('#password')?.focus();
    });
  }

  if (page === 'admin') {
    if (sessionStorage.getItem('pnc.adminAuthenticated') !== 'true') {
      window.location.replace('login.html');
      return;
    }

    const form = document.querySelector('#result-form');
    const formTitle = document.querySelector('#form-title');
    const recordIdInput = document.querySelector('#record-id');
    const saveButton = document.querySelector('#save-button');
    const updateButton = document.querySelector('#update-button');
    const saveMessage = document.querySelector('#save-message');
    const recordSearch = document.querySelector('#records-search');
    const recordsList = document.querySelector('#records-list');
    const recordsEmpty = document.querySelector('#records-empty');
    const recordCount = document.querySelector('#record-count');
    const passPercentageInput = document.querySelector('#pass-percentage');
    const criteriaMessage = document.querySelector('#criteria-message');

    function getFormRecord() {
      const data = new FormData(form);
      const marks = {};
      SUBJECTS.forEach(({ key }) => {
        const total = data.get(`${key}Total`);
        const obtained = data.get(`${key}Obtained`);
        marks[key] = {
          total: total === null || total === '' ? null : Number(total),
          obtained: obtained === null || obtained === '' ? null : Number(obtained)
        };
      });
      const totalRaw = data.get('totalMarks');
      const obtainedRaw = data.get('obtainedMarks');
      const summary = calculateSummary(totalRaw, obtainedRaw, marks, Number(passPercentageInput.value));
      return {
        id: recordIdInput.value || (window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name: String(data.get('name')).trim(),
        fatherName: String(data.get('fatherName')).trim(),
        rollNumber: String(data.get('rollNumber')).trim(),
        className: String(data.get('className')).trim(),
        section: String(data.get('section')).trim(),
        date: String(data.get('date')).trim(),
        remarks: String(data.get('remarks')).trim(),
        marks,
        totalMarks: totalRaw === null || totalRaw === '' ? null : Number(totalRaw),
        obtainedMarks: obtainedRaw === null || obtainedRaw === '' ? null : Number(obtainedRaw),
        percentage: summary.percentage,
        resultStatus: summary.status
      };
    }

    function updateSummary() {
      const data = new FormData(form);
      const marks = {};
      SUBJECTS.forEach(({ key }) => {
        const total = data.get(`${key}Total`);
        const obtained = data.get(`${key}Obtained`);
        marks[key] = {
          total: total === null || total === '' ? null : Number(total),
          obtained: obtained === null || obtained === '' ? null : Number(obtained)
        };
      });
      const totalValue = document.querySelector('#total-marks').value;
      const obtainedValue = document.querySelector('#obtained-marks').value;
      const summary = calculateSummary(totalValue, obtainedValue, marks, Number(passPercentageInput.value));
      document.querySelector('#percentage').textContent = summary.percentage === null ? '—' : `${formatNumber(summary.percentage)}%`;
      const status = document.querySelector('#result-status');
      status.textContent = summary.status;
      status.className = `status-pill ${statusClass(summary.status)}`;
    }

    function renderRecords() {
      const records = readResults().sort((first, second) => first.name.localeCompare(second.name));
      const query = recordSearch.value.trim().toLocaleLowerCase();
      const visible = records.filter((record) =>
        record.name.toLocaleLowerCase().includes(query) ||
        record.rollNumber.toLocaleLowerCase().includes(query)
      );
      recordCount.textContent = String(records.length);
      recordsList.innerHTML = visible.map((record) => `
        <div class="record-item">
          <div class="record-info"><strong>${escapeHTML(record.name)}</strong><span>${escapeHTML(record.rollNumber)}</span></div>
          <div class="record-actions">
            <button type="button" data-edit-record="${escapeHTML(record.id)}">Edit</button>
            <button type="button" class="delete-record" data-delete-record="${escapeHTML(record.id)}" aria-label="Delete ${escapeHTML(record.name)}">Delete</button>
          </div>
        </div>`).join('');
      recordsEmpty.hidden = visible.length > 0;
      recordsEmpty.textContent = records.length === 0
        ? 'No saved results yet. Add a student record to get started.'
        : 'No results match your search.';
    }

    function resetEditor() {
      form.reset();
      recordIdInput.value = '';
      formTitle.textContent = 'Enter student result';
      saveButton.hidden = false;
      updateButton.hidden = true;
      setMessage(saveMessage, '');
      updateSummary();
    }

    function loadRecord(id) {
      const record = readResults().find((item) => item.id === id);
      if (!record) {
        setMessage(saveMessage, 'That result could not be found. Refresh the records list and try again.');
        renderRecords();
        return;
      }
      recordIdInput.value = record.id;
      const fields = {
        name: record.name,
        fatherName: record.fatherName,
        rollNumber: record.rollNumber,
        className: record.className,
        section: record.section,
        date: record.date,
        remarks: record.remarks
      };
      Object.entries(fields).forEach(([name, value]) => { form.elements.namedItem(name).value = value || ''; });
      SUBJECTS.forEach(({ key }) => {
        const marks = readSubjectMarks(record.marks, key);
        form.elements.namedItem(`${key}Total`).value = marks.total ?? '';
        form.elements.namedItem(`${key}Obtained`).value = marks.obtained ?? '';
      });
      form.elements.namedItem('totalMarks').value = record.totalMarks ?? '';
      form.elements.namedItem('obtainedMarks').value = record.obtainedMarks ?? '';
      formTitle.textContent = `Editing ${record.name}`;
      saveButton.hidden = true;
      updateButton.hidden = false;
      setMessage(saveMessage, '');
      updateSummary();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function persistRecord(isUpdate) {
      if (!form.reportValidity()) return;
      const record = getFormRecord();
      const hasTotal = record.totalMarks !== null;
      const hasObtained = record.obtainedMarks !== null;
      if (hasTotal !== hasObtained) {
        setMessage(saveMessage, 'Enter both overall Total Marks and Obtained Marks, or leave both blank.');
        return;
      }
      if (hasTotal && record.totalMarks <= 0) {
        setMessage(saveMessage, 'Overall Total Marks must be greater than zero.');
        document.querySelector('#total-marks').focus();
        return;
      }
      if (hasTotal && record.obtainedMarks > record.totalMarks) {
        setMessage(saveMessage, 'Obtained Marks cannot be greater than Total Marks.');
        document.querySelector('#obtained-marks').focus();
        return;
      }
      for (const subject of SUBJECTS) {
        const subjectMarks = record.marks[subject.key];
        const hasSubjectTotal = subjectMarks.total !== null;
        const hasSubjectObtained = subjectMarks.obtained !== null;
        if (hasSubjectTotal !== hasSubjectObtained) {
          setMessage(saveMessage, `Enter both Total Marks and Obtained Marks for ${subject.label}, or leave both blank.`);
          document.querySelector(`[name="${subject.key}${hasSubjectTotal ? 'Obtained' : 'Total'}"]`).focus();
          return;
        }
        if (hasSubjectTotal && subjectMarks.total <= 0) {
          setMessage(saveMessage, `Total Marks for ${subject.label} must be greater than zero.`);
          document.querySelector(`[name="${subject.key}Total"]`).focus();
          return;
        }
        if (hasSubjectTotal && subjectMarks.obtained > subjectMarks.total) {
          setMessage(saveMessage, `Obtained Marks for ${subject.label} cannot be greater than its Total Marks.`);
          document.querySelector(`[name="${subject.key}Obtained"]`).focus();
          return;
        }
      }
      const existingRecords = readResults();
      const duplicate = existingRecords.find((item) =>
        normalizeRoll(item.rollNumber) === normalizeRoll(record.rollNumber) && item.id !== record.id
      );
      if (duplicate) {
        setMessage(saveMessage, `Roll number ${record.rollNumber} is already saved. Edit that record to update it.`);
        document.querySelector('#roll-number').focus();
        return;
      }
      let updatedRecords;
      if (isUpdate) {
        const existingIndex = existingRecords.findIndex((item) => item.id === record.id);
        if (existingIndex === -1) {
          setMessage(saveMessage, 'This result no longer exists. Save it as a new record instead.');
          return;
        }
        updatedRecords = existingRecords.slice();
        updatedRecords[existingIndex] = record;
      } else {
        updatedRecords = [...existingRecords, record];
      }
      try {
        writeResults(updatedRecords);
      } catch (error) {
        setMessage(saveMessage, `Unable to save result: ${error.message}`);
        return;
      }
      resetEditor();
      renderRecords();
      setMessage(saveMessage, isUpdate ? 'Result updated successfully.' : 'Result saved successfully.', false);
    }

    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      persistRecord(false);
    });
    updateButton.addEventListener('click', () => persistRecord(true));
    recordSearch.addEventListener('input', renderRecords);
    recordsList.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.editRecord) {
        loadRecord(button.dataset.editRecord);
        return;
      }
      if (button.dataset.deleteRecord) {
        const record = readResults().find((item) => item.id === button.dataset.deleteRecord);
        if (!record || !window.confirm(`Delete the result for ${record.name} (${record.rollNumber})? This cannot be undone.`)) return;
        try {
          writeResults(readResults().filter((item) => item.id !== record.id));
          if (recordIdInput.value === record.id) resetEditor();
          setMessage(saveMessage, 'Result deleted.', false);
          renderRecords();
        } catch (error) {
          setMessage(saveMessage, `Unable to delete result: ${error.message}`);
        }
      }
    });
    document.querySelector('#clear-button').addEventListener('click', () => {
      window.setTimeout(() => {
        resetEditor();
      }, 0);
    });
    passPercentageInput.value = String(getPassingPercentage());
    passPercentageInput.addEventListener('change', () => {
      if (!passPercentageInput.reportValidity()) return;
      try {
        const percentage = Number(passPercentageInput.value);
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
          throw new Error('Enter a passing percentage from 0 to 100.');
        }
        window.localStorage.setItem(PASS_PERCENTAGE_KEY, String(percentage));
        setMessage(criteriaMessage, 'Passing criteria saved.', false);
        updateSummary();
      } catch (error) {
        setMessage(criteriaMessage, `Unable to save passing criteria: ${error.message}`);
      }
    });
    document.querySelector('#logout-button').addEventListener('click', () => {
      sessionStorage.removeItem('pnc.adminAuthenticated');
      window.location.href = 'index.html';
    });

    updateSummary();
    try {
      renderRecords();
    } catch (error) {
      setMessage(saveMessage, `Unable to load saved results: ${error.message}`);
    }
  }
})();
