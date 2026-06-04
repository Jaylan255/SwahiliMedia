<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/logger.php';

function security_rate_limit(string $bucket, int $limit, int $windowSeconds): void
{
    $directory = security_storage_path('ratelimits');
    security_ensure_directory($directory);

    $key = hash('sha256', $bucket . '|' . security_client_ip());
    $file = $directory . DIRECTORY_SEPARATOR . $key . '.json';
    $now = time();
    $windowStart = $now - $windowSeconds;

    $attempts = [];
    if (is_file($file)) {
        $decoded = json_decode((string) file_get_contents($file), true);
        if (is_array($decoded)) {
            $attempts = array_values(array_filter($decoded, static fn ($timestamp) => is_int($timestamp) && $timestamp >= $windowStart));
        }
    }

    if (count($attempts) >= $limit) {
        header('Retry-After: ' . $windowSeconds);
        security_log_event('rate_limit_block', ['bucket' => $bucket, 'limit' => $limit, 'window' => $windowSeconds]);
        security_json_response([
            'status' => 'error',
            'message' => 'Too many requests. Please try again later.',
        ], 429);
    }

    $attempts[] = $now;
    file_put_contents($file, json_encode($attempts), LOCK_EX);
}
