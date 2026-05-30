<?php

declare(strict_types=1);

function security_env(string $key, ?string $default = null): ?string
{
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);

    if ($value === false || $value === null || $value === '') {
        return $default;
    }

    return is_string($value) ? trim($value) : $default;
}

function security_storage_path(string $path = ''): string
{
    $base = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage';
    return $path === '' ? $base : $base . DIRECTORY_SEPARATOR . ltrim($path, '\\/');
}

function security_ensure_directory(string $directory): void
{
    if (!is_dir($directory)) {
        mkdir($directory, 0775, true);
    }
}

function security_client_ip(): string
{
    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($forwarded !== '') {
        $parts = array_map('trim', explode(',', $forwarded));
        if (!empty($parts[0])) {
            return $parts[0];
        }
    }

    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function security_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function security_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function security_generate_random_base32(int $length = 32): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bytes = random_bytes($length);
    $output = '';

    for ($i = 0; $i < $length; $i++) {
        $output .= $alphabet[ord($bytes[$i]) % strlen($alphabet)];
    }

    return $output;
}
