<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function security_log_event(string $type, array $context = []): void
{
    $directory = security_storage_path('logs');
    security_ensure_directory($directory);

    $record = [
        'timestamp' => gmdate('c'),
        'type' => $type,
        'ip' => security_client_ip(),
        'uri' => $_SERVER['REQUEST_URI'] ?? '',
        'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'context' => $context,
    ];

    $file = $directory . DIRECTORY_SEPARATOR . 'security-' . gmdate('Y-m-d') . '.log';
    file_put_contents($file, json_encode($record, JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND | LOCK_EX);
}
