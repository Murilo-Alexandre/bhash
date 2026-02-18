import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Backend Online 🚀</title>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', sans-serif;
        }

        body {
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #4f46e5, #9333ea);
          color: white;
          text-align: center;
          overflow: hidden;
        }

        .card {
          background: rgba(255, 255, 255, 0.1);
          padding: 50px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          animation: fadeIn 1s ease-in-out;
        }

        h1 {
          font-size: 3rem;
          margin-bottom: 20px;
        }

        .status {
          margin-top: 20px;
          font-weight: bold;
          color: #22c55e;
          font-size: 1.4rem;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      </style>
    </head>
    <body>
      <div class="card pulse">
        <h1>🚀 Backend Online!</h1>
        <p>Seu NestJS está funcionando perfeitamente.</p>
        <div class="status">✔ API Rodando</div>
      </div>

      <script>
        function explode() {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
          });
        }

        window.onload = () => {
          explode();
          setTimeout(explode, 500);
        };
      </script>
    </body>
    </html>
    `;
  }
}
