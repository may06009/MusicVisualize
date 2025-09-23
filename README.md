1. Server 폴더 아래 .env 파일 필요
.env 파일 구성{
PORT=4000
CLIENT_URL=http://localhost:5173
STORAGE_DIR=public/viz-data
JWT_SECRET=(임의의 값 입력)
DB_PATH=./data.db

GOOGLE_CLIENT_ID=(클라이언트 아이디)
GOOGLE_CLIENT_SECRET=(클라이언트 비밀번호)
GOOGLE_CALLBACK_URL=http://localhost:4000/oauth/google/callback

NAVER_CLIENT_ID=(클라이언트 아이디)
NAVER_CLIENT_SECRET=(클라이언트 비밀번호)
NAVER_CALLBACK_URL=http://localhost:4000/oauth/naver/callback

MODEL_SCRIPT=C:/Users/PC/Desktop/model-ml/make_viz.py
MODEL_CWD=C:/Users/PC/Desktop/model-ml

KEEP_UPLOADS=1
}


2. 실행 방법
*실행 전 반드시 모델 쪽 필요 패키지와 라이브러리를 담은 환경 활성화 필요!(Conda로 작업)*

터미널 생성 → server로 이동(cd server) → 터미널에 npm run dev 입력

터미널 생성 → web으로 이동(cd web) → 터미널에 npm run dev 입력 → 웹브라우저 주소로 이동