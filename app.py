from flask import Flask, render_template, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import pytesseract
from PIL import Image
import io

app = Flask(__name__)

# OPTIONAL: Set tesseract path directly if not in PATH
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def preprocess_text(text):
    if not text:
        return ""
    # Basic cleaning: remove extra spaces, lowercase
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def calculate_similarity(text1, text2):
    # If both are empty or identical
    if not text1 or not text2:
        return 0.0
    
    # Create the Document Term Matrix
    vectorizer = TfidfVectorizer()
    try:
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        # Calculate Cosine Similarity
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        # BOOSTING LOGIC: Make scoring less strict
        # Original cosine gives 0.0 to 1.0. 
        # Valid answers often score 0.5-0.7. We want to map this higher.
        # Approach: Square Root Curve (boosts lower scores more) or simple multiplier.
        
        # Example: If score is 0.5 (50%), sqrt(0.5) = 0.707 (70%).
        # Example: If score is 0.8 (80%), sqrt(0.8) = 0.894 (89%).
        
        boosted_score = similarity ** 0.5  
        
        return min(boosted_score * 100, 100.0)
    except ValueError:
        # Happens if vocab is empty (e.g. stop words only or empty text)
        return 0.0

def extract_text_from_image(image_file):
    try:
        img = Image.open(image_file)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        print(f"Error extracting text: {e}")
        return f"Error extracting text: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/evaluate_exam', methods=['POST'])
def evaluate_exam():
    results = []
    grand_total_obtained = 0
    grand_total_max = 0
    
    try:
        question_count = int(request.form.get('question_count', 0))
    except ValueError:
        return jsonify({'error': 'Invalid question count'}), 400

    for i in range(question_count):
        # 1. Get Model Answer
        model_type = request.form.get(f'q_{i}_model_type', 'text')
        model_text = ""
        if model_type == 'image':
            file_key = f'q_{i}_model_data'
            if file_key in request.files:
                model_text = extract_text_from_image(request.files[file_key])
        else:
            model_text = request.form.get(f'q_{i}_model_data', '')

        # 2. Get Student Answer
        student_type = request.form.get(f'q_{i}_student_type', 'text')
        student_text = ""
        if student_type == 'image':
            file_key = f'q_{i}_student_data'
            if file_key in request.files:
                student_text = extract_text_from_image(request.files[file_key])
        else:
            student_text = request.form.get(f'q_{i}_student_data', '')

        # 3. Marks
        try:
            max_marks = float(request.form.get(f'q_{i}_marks', 10))
        except ValueError:
            max_marks = 10.0

        # Calculation
        clean_model = preprocess_text(model_text)
        clean_student = preprocess_text(student_text)
        
        score_val = calculate_similarity(clean_model, clean_student)
        
        # Rounding Logic
        raw_marks = (score_val / 100) * max_marks
        marks_obtained = round(raw_marks * 2) / 2
        
        grand_total_obtained += marks_obtained
        grand_total_max += max_marks
        
        # Short Feedback
        feedback_msg = "Needs improvement"
        if score_val > 90: feedback_msg = "Excellent"
        elif score_val > 70: feedback_msg = "Good"
        elif score_val > 40: feedback_msg = "Fair"

        results.append({
            'score': round(score_val, 1),
            'marks_obtained': marks_obtained,
            'max_marks': max_marks,
            'feedback': feedback_msg
        })

    return jsonify({
        'grand_total_obtained': grand_total_obtained,
        'grand_total_max': grand_total_max,
        'results': results
    })

if __name__ == '__main__':
    app.run(debug=True)
