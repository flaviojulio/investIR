Ativa o ambiente virtual:>  **venv/Scripts/activate** 

Iniciar conversa com o Claude Code

Olá! Leia o arquivo [CLAUDE.md] para entender o contexto do projeto e minhas preferências antes de começarmos.

leia o arquivo claude.md e investIR\claude\agents\README.md  

Utilizar o bypass
claude --dangerously-skip-permissions

ficou ótimo! Pode comitar e fazer o push       

Iniciar backend

cd backend
pip install -r requirements.txt
uvicorn main:app --reload
cd "C:\Projeto Fortuna\investIR\backend"; uvicorn main:app --reload

Iniciar Frontend

cd frontend
npm install
**npm run dev**
cd "C:\Projeto Fortuna\investIR\frontend"; npm run dev