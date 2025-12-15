let questionCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Add first question by default
    addQuestion();
});

function addQuestion() {
    questionCount++;
    const container = document.getElementById('questions-container');
    const template = document.getElementById('question-template');

    const clone = template.content.cloneNode(true);
    const block = clone.querySelector('.question-block');

    block.dataset.id = questionCount;
    block.querySelector('.q-number').textContent = questionCount;

    // Setup tabs logic within this specific block
    // (Handled via onclick="switchTab(this, ...)" in HTML)

    container.appendChild(block);

    // Scroll to new question
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeQuestion(btn) {
    const block = btn.closest('.question-block');
    const container = document.getElementById('questions-container');

    if (container.children.length > 1) {
        block.remove();
        renumberQuestions();
    } else {
        alert("You must have at least one question.");
    }
}

function renumberQuestions() {
    const questions = document.querySelectorAll('.question-block');
    questions.forEach((q, index) => {
        q.querySelector('.q-number').textContent = index + 1;
    });
    questionCount = questions.length;
}

function switchTab(btn, mode) {
    const card = btn.closest('.input-card');
    const tabs = card.querySelectorAll('.tab-btn');
    const contents = card.querySelectorAll('.tab-content');

    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    contents.forEach(c => c.classList.remove('active'));

    if (mode === 'text') {
        card.querySelector('.text-content').classList.add('active');
    } else {
        card.querySelector('.image-content').classList.add('active');
    }

    // Tag the card with current mode for submission logic
    card.dataset.mode = mode;
}

function previewImage(input) {
    const preview = input.closest('.file-upload-box').nextElementSibling;
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    }
}

async function evaluateExam() {
    const formData = new FormData();
    const questions = document.querySelectorAll('.question-block');
    let hasError = false;

    questions.forEach((q, index) => {
        const i = index; // 0-based index for backend

        // Max Marks
        formData.append(`q_${i}_marks`, q.querySelector('.q-max-marks').value);

        // Model Answer
        const modelCard = q.querySelector('.model-card');
        const modelMode = modelCard.dataset.mode || 'text'; // Default to text if not switched

        if (modelMode === 'text') {
            const val = modelCard.querySelector('.q-model-text').value.trim();
            formData.append(`q_${i}_model_type`, 'text');
            formData.append(`q_${i}_model_data`, val);
            if (!val) hasError = true;
        } else {
            const file = modelCard.querySelector('.q-model-image').files[0];
            formData.append(`q_${i}_model_type`, 'image');
            if (file) formData.append(`q_${i}_model_data`, file);
            else hasError = true;
        }

        // Student Answer
        const studentCard = q.querySelector('.student-card');
        const studentMode = studentCard.dataset.mode || 'text';

        if (studentMode === 'text') {
            const val = studentCard.querySelector('.q-student-text').value.trim();
            formData.append(`q_${i}_student_type`, 'text');
            formData.append(`q_${i}_student_data`, val);
            if (!val) hasError = true;
        } else {
            const file = studentCard.querySelector('.q-student-image').files[0];
            formData.append(`q_${i}_student_type`, 'image');
            if (file) formData.append(`q_${i}_student_data`, file);
            else hasError = true;
        }
    });

    formData.append('question_count', questions.length);

    if (hasError) {
        alert("Please fill in all answers (Text or Image) for every question.");
        return;
    }

    // Submit
    const btn = document.getElementById('evaluate-btn');
    const oldText = btn.innerText;
    btn.innerText = "Evaluating Exam...";
    btn.disabled = true;

    try {
        const response = await fetch('/evaluate_exam', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        displayResults(data);
    } catch (e) {
        console.error(e);
        alert("Error evaluating exam.");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

function displayResults(data) {
    const resultSection = document.getElementById('result-section');
    const totalDisplay = document.getElementById('grand-total-display');
    const detailsDiv = document.getElementById('detailed-results');

    totalDisplay.innerText = `${data.grand_total_obtained} / ${data.grand_total_max}`;

    let html = `
    <table class="result-table">
        <thead>
            <tr>
                <th>Q#</th>
                <th>Marks</th>
                <th>Similarity</th>
                <th>Feedback</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.results.forEach((res, index) => {
        html += `
        <tr>
            <td><strong>${index + 1}</strong></td>
            <td>
                <span class="score-badge">${res.marks_obtained} / ${res.max_marks}</span>
            </td>
            <td>${res.score}%</td>
            <td><p class="feedback-text">${res.feedback}</p></td>
        </tr>
        `;
    });

    html += `</tbody></table>`;
    detailsDiv.innerHTML = html;

    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });
}
