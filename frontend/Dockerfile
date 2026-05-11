# # Используем официальный образ Node.js
# FROM node:20

# # Устанавливаем рабочую директорию
# WORKDIR /app

# # Копируем файлы package.json и package-lock.json
# COPY package*.json ./

# # Устанавливаем зависимости
# RUN npm install

# # Копируем исходный код React
# COPY . .

# # Собираемверсию фронтенда
# RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Копируем только package файлы сначала (для кэширования слоёв)
COPY package*.json ./
RUN npm ci --only=production=false

# Копируем остальной код
COPY . .

ENV CHOKIDAR_USEPOLLING=true
ENV NODE_ENV=development

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]