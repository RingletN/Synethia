# # # Используем официальный образ PHP с FPM и нужными расширениями
# # FROM php:8.4-fpm

# # # Устанавливаем системные зависимости и драйверы для PostgreSQL
# # RUN apt-get update && apt-get install -y \
# #     libpq-dev \
# #     && docker-php-ext-install pdo_pgsql

# # # Устанавливаем Composer (менеджер зависимостей PHP)
# # COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# # # Устанавливаем рабочую директорию внутри контейнера
# # WORKDIR /var/www/html

# # # Копируем файлы нашего Laravel-проекта в контейнер
# # COPY . .

# # # Запускаем Composer для установки зависимостей
# # RUN composer install

# FROM php:8.4-fpm

# # Устанавливаем системные зависимости
# RUN apt-get update && apt-get install -y \
#     libpq-dev \
#     unzip \
#     git \
#     curl \
#     && docker-php-ext-install pdo_pgsql \
#     && apt-get clean && rm -rf /var/lib/apt/lists/*

# # Устанавливаем Composer
# COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# WORKDIR /var/www/html

# # Копируем только composer файлы сначала (для кэширования)
# COPY composer.json composer.lock ./

# # Устанавливаем зависимости
# RUN composer install --no-dev --optimize-autoloader --no-scripts

# # Теперь копируем весь проект
# COPY . .

# # Даём права на storage и bootstrap/cache
# RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
#     && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# # Запускаем Laravel (php-fpm)
# CMD ["php-fpm"]