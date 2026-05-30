<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function security_base32_decode(string $input): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $input = strtoupper(preg_replace('/[^A-Z2-7]/', '', $input) ?? '');

    $bits = '';
    $output = '';

    foreach (str_split($input) as $char) {
        $position = strpos($alphabet, $char);
        if ($position === false) {
            continue;
        }

        $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
    }

    foreach (str_split($bits, 8) as $chunk) {
        if (strlen($chunk) === 8) {
            $output .= chr(bindec($chunk));
        }
    }

    return $output;
}

function security_totp_verify(string $secret, string $code, int $window = 1, int $timeStep = 30): bool
{
    $normalizedCode = preg_replace('/\D+/', '', $code) ?? '';
    if (strlen($normalizedCode) !== 6) {
        return false;
    }

    $key = security_base32_decode($secret);
    if ($key === '') {
        return false;
    }

    $counter = (int) floor(time() / $timeStep);

    for ($offset = -$window; $offset <= $window; $offset++) {
        $binaryCounter = pack('N*', 0) . pack('N*', $counter + $offset);
        $hash = hash_hmac('sha1', $binaryCounter, $key, true);
        $position = ord(substr($hash, -1)) & 0x0F;
        $segment = substr($hash, $position, 4);
        $value = unpack('N', $segment)[1] & 0x7FFFFFFF;
        $generated = str_pad((string) ($value % 1000000), 6, '0', STR_PAD_LEFT);

        if (hash_equals($generated, $normalizedCode)) {
            return true;
        }
    }

    return false;
}
