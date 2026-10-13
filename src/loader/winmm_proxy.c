#include <windows.h>
#include <wchar.h>

static HMODULE hRealDll = NULL;
static FARPROC pFuncs[180];

DWORD WINAPI WorkerThread(LPVOID lpParam) {
    LPCWSTR cmd = GetCommandLineW();
    if (wcsstr(cmd, L"--type=") != NULL) {
        return 0;
    }
    Sleep(3500);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    ZeroMemory(&pi, sizeof(pi));

    WCHAR targetScript[MAX_PATH] = {0};

    // 1. Priority 1: Check office-viewer\\index.js in the same directory as Antigravity.exe
    WCHAR appScript[MAX_PATH];
    if (GetModuleFileNameW(NULL, appScript, MAX_PATH) > 0) {
        WCHAR* lastSlash = wcsrchr(appScript, L'\\');
        if (lastSlash) {
            wcscpy(lastSlash + 1, L"office-viewer\\index.js");
            if (GetFileAttributesW(appScript) != INVALID_FILE_ATTRIBUTES) {
                wcscpy(targetScript, appScript);
            }
        }
    }

    // 2. Priority 2: Fallback to USERPROFILE directories
    if (targetScript[0] == L'\0') {
        WCHAR userProfile[MAX_PATH];
        if (GetEnvironmentVariableW(L"USERPROFILE", userProfile, MAX_PATH) > 0) {
            WCHAR p1[MAX_PATH];
            wsprintfW(p1, L"%s\\.gemini\\antigravity\\scratch\\antigravity-office-viewer\\index.js", userProfile);
            if (GetFileAttributesW(p1) != INVALID_FILE_ATTRIBUTES) {
                wcscpy(targetScript, p1);
            } else {
                WCHAR p2[MAX_PATH];
                wsprintfW(p2, L"%s\\.gemini\\antigravity\\office-hook\\office_cdp_hook.js", userProfile);
                if (GetFileAttributesW(p2) != INVALID_FILE_ATTRIBUTES) {
                    wcscpy(targetScript, p2);
                }
            }
        }
    }

    if (targetScript[0] != L'\0') {
        WCHAR cmdLine[1024];
        wsprintfW(cmdLine, L"node \"%s\" --daemon", targetScript);
        if (CreateProcessW(NULL, cmdLine, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
    }
    return 0;
}

void InitProxy(void) {
    if (hRealDll) return;
    WCHAR sysPath[MAX_PATH];
    GetSystemDirectoryW(sysPath, MAX_PATH);
    wcscat(sysPath, L"\\winmm.dll");
    hRealDll = LoadLibraryW(sysPath);
    if (!hRealDll) return;
    pFuncs[0] = GetProcAddress(hRealDll, "CloseDriver");
    pFuncs[1] = GetProcAddress(hRealDll, "DefDriverProc");
    pFuncs[2] = GetProcAddress(hRealDll, "DriverCallback");
    pFuncs[3] = GetProcAddress(hRealDll, "DrvGetModuleHandle");
    pFuncs[4] = GetProcAddress(hRealDll, "GetDriverModuleHandle");
    pFuncs[5] = GetProcAddress(hRealDll, "OpenDriver");
    pFuncs[6] = GetProcAddress(hRealDll, "PlaySound");
    pFuncs[7] = GetProcAddress(hRealDll, "PlaySoundA");
    pFuncs[8] = GetProcAddress(hRealDll, "PlaySoundW");
    pFuncs[9] = GetProcAddress(hRealDll, "SendDriverMessage");
    pFuncs[10] = GetProcAddress(hRealDll, "WOWAppExit");
    pFuncs[11] = GetProcAddress(hRealDll, "auxGetDevCapsA");
    pFuncs[12] = GetProcAddress(hRealDll, "auxGetDevCapsW");
    pFuncs[13] = GetProcAddress(hRealDll, "auxGetNumDevs");
    pFuncs[14] = GetProcAddress(hRealDll, "auxGetVolume");
    pFuncs[15] = GetProcAddress(hRealDll, "auxOutMessage");
    pFuncs[16] = GetProcAddress(hRealDll, "auxSetVolume");
    pFuncs[17] = GetProcAddress(hRealDll, "joyConfigChanged");
    pFuncs[18] = GetProcAddress(hRealDll, "joyGetDevCapsA");
    pFuncs[19] = GetProcAddress(hRealDll, "joyGetDevCapsW");
    pFuncs[20] = GetProcAddress(hRealDll, "joyGetNumDevs");
    pFuncs[21] = GetProcAddress(hRealDll, "joyGetPos");
    pFuncs[22] = GetProcAddress(hRealDll, "joyGetPosEx");
    pFuncs[23] = GetProcAddress(hRealDll, "joyGetThreshold");
    pFuncs[24] = GetProcAddress(hRealDll, "joyReleaseCapture");
    pFuncs[25] = GetProcAddress(hRealDll, "joySetCapture");
    pFuncs[26] = GetProcAddress(hRealDll, "joySetThreshold");
    pFuncs[27] = GetProcAddress(hRealDll, "mciDriverNotify");
    pFuncs[28] = GetProcAddress(hRealDll, "mciDriverYield");
    pFuncs[29] = GetProcAddress(hRealDll, "mciExecute");
    pFuncs[30] = GetProcAddress(hRealDll, "mciFreeCommandResource");
    pFuncs[31] = GetProcAddress(hRealDll, "mciGetCreatorTask");
    pFuncs[32] = GetProcAddress(hRealDll, "mciGetDeviceIDA");
    pFuncs[33] = GetProcAddress(hRealDll, "mciGetDeviceIDFromElementIDA");
    pFuncs[34] = GetProcAddress(hRealDll, "mciGetDeviceIDFromElementIDW");
    pFuncs[35] = GetProcAddress(hRealDll, "mciGetDeviceIDW");
    pFuncs[36] = GetProcAddress(hRealDll, "mciGetDriverData");
    pFuncs[37] = GetProcAddress(hRealDll, "mciGetErrorStringA");
    pFuncs[38] = GetProcAddress(hRealDll, "mciGetErrorStringW");
    pFuncs[39] = GetProcAddress(hRealDll, "mciGetYieldProc");
    pFuncs[40] = GetProcAddress(hRealDll, "mciLoadCommandResource");
    pFuncs[41] = GetProcAddress(hRealDll, "mciSendCommandA");
    pFuncs[42] = GetProcAddress(hRealDll, "mciSendCommandW");
    pFuncs[43] = GetProcAddress(hRealDll, "mciSendStringA");
    pFuncs[44] = GetProcAddress(hRealDll, "mciSendStringW");
    pFuncs[45] = GetProcAddress(hRealDll, "mciSetDriverData");
    pFuncs[46] = GetProcAddress(hRealDll, "mciSetYieldProc");
    pFuncs[47] = GetProcAddress(hRealDll, "midiConnect");
    pFuncs[48] = GetProcAddress(hRealDll, "midiDisconnect");
    pFuncs[49] = GetProcAddress(hRealDll, "midiInAddBuffer");
    pFuncs[50] = GetProcAddress(hRealDll, "midiInClose");
    pFuncs[51] = GetProcAddress(hRealDll, "midiInGetDevCapsA");
    pFuncs[52] = GetProcAddress(hRealDll, "midiInGetDevCapsW");
    pFuncs[53] = GetProcAddress(hRealDll, "midiInGetErrorTextA");
    pFuncs[54] = GetProcAddress(hRealDll, "midiInGetErrorTextW");
    pFuncs[55] = GetProcAddress(hRealDll, "midiInGetID");
    pFuncs[56] = GetProcAddress(hRealDll, "midiInGetNumDevs");
    pFuncs[57] = GetProcAddress(hRealDll, "midiInMessage");
    pFuncs[58] = GetProcAddress(hRealDll, "midiInOpen");
    pFuncs[59] = GetProcAddress(hRealDll, "midiInPrepareHeader");
    pFuncs[60] = GetProcAddress(hRealDll, "midiInReset");
    pFuncs[61] = GetProcAddress(hRealDll, "midiInStart");
    pFuncs[62] = GetProcAddress(hRealDll, "midiInStop");
    pFuncs[63] = GetProcAddress(hRealDll, "midiInUnprepareHeader");
    pFuncs[64] = GetProcAddress(hRealDll, "midiOutCacheDrumPatches");
    pFuncs[65] = GetProcAddress(hRealDll, "midiOutCachePatches");
    pFuncs[66] = GetProcAddress(hRealDll, "midiOutClose");
    pFuncs[67] = GetProcAddress(hRealDll, "midiOutGetDevCapsA");
    pFuncs[68] = GetProcAddress(hRealDll, "midiOutGetDevCapsW");
    pFuncs[69] = GetProcAddress(hRealDll, "midiOutGetErrorTextA");
    pFuncs[70] = GetProcAddress(hRealDll, "midiOutGetErrorTextW");
    pFuncs[71] = GetProcAddress(hRealDll, "midiOutGetID");
    pFuncs[72] = GetProcAddress(hRealDll, "midiOutGetNumDevs");
    pFuncs[73] = GetProcAddress(hRealDll, "midiOutGetVolume");
    pFuncs[74] = GetProcAddress(hRealDll, "midiOutLongMsg");
    pFuncs[75] = GetProcAddress(hRealDll, "midiOutMessage");
    pFuncs[76] = GetProcAddress(hRealDll, "midiOutOpen");
    pFuncs[77] = GetProcAddress(hRealDll, "midiOutPrepareHeader");
    pFuncs[78] = GetProcAddress(hRealDll, "midiOutReset");
    pFuncs[79] = GetProcAddress(hRealDll, "midiOutSetVolume");
    pFuncs[80] = GetProcAddress(hRealDll, "midiOutShortMsg");
    pFuncs[81] = GetProcAddress(hRealDll, "midiOutUnprepareHeader");
    pFuncs[82] = GetProcAddress(hRealDll, "midiStreamClose");
    pFuncs[83] = GetProcAddress(hRealDll, "midiStreamOpen");
    pFuncs[84] = GetProcAddress(hRealDll, "midiStreamOut");
    pFuncs[85] = GetProcAddress(hRealDll, "midiStreamPause");
    pFuncs[86] = GetProcAddress(hRealDll, "midiStreamPosition");
    pFuncs[87] = GetProcAddress(hRealDll, "midiStreamProperty");
    pFuncs[88] = GetProcAddress(hRealDll, "midiStreamRestart");
    pFuncs[89] = GetProcAddress(hRealDll, "midiStreamStop");
    pFuncs[90] = GetProcAddress(hRealDll, "mixerClose");
    pFuncs[91] = GetProcAddress(hRealDll, "mixerGetControlDetailsA");
    pFuncs[92] = GetProcAddress(hRealDll, "mixerGetControlDetailsW");
    pFuncs[93] = GetProcAddress(hRealDll, "mixerGetDevCapsA");
    pFuncs[94] = GetProcAddress(hRealDll, "mixerGetDevCapsW");
    pFuncs[95] = GetProcAddress(hRealDll, "mixerGetID");
    pFuncs[96] = GetProcAddress(hRealDll, "mixerGetLineControlsA");
    pFuncs[97] = GetProcAddress(hRealDll, "mixerGetLineControlsW");
    pFuncs[98] = GetProcAddress(hRealDll, "mixerGetLineInfoA");
    pFuncs[99] = GetProcAddress(hRealDll, "mixerGetLineInfoW");
    pFuncs[100] = GetProcAddress(hRealDll, "mixerGetNumDevs");
    pFuncs[101] = GetProcAddress(hRealDll, "mixerMessage");
    pFuncs[102] = GetProcAddress(hRealDll, "mixerOpen");
    pFuncs[103] = GetProcAddress(hRealDll, "mixerSetControlDetails");
    pFuncs[104] = GetProcAddress(hRealDll, "mmDrvInstall");
    pFuncs[105] = GetProcAddress(hRealDll, "mmGetCurrentTask");
    pFuncs[106] = GetProcAddress(hRealDll, "mmTaskBlock");
    pFuncs[107] = GetProcAddress(hRealDll, "mmTaskCreate");
    pFuncs[108] = GetProcAddress(hRealDll, "mmTaskSignal");
    pFuncs[109] = GetProcAddress(hRealDll, "mmTaskYield");
    pFuncs[110] = GetProcAddress(hRealDll, "mmioAdvance");
    pFuncs[111] = GetProcAddress(hRealDll, "mmioAscend");
    pFuncs[112] = GetProcAddress(hRealDll, "mmioClose");
    pFuncs[113] = GetProcAddress(hRealDll, "mmioCreateChunk");
    pFuncs[114] = GetProcAddress(hRealDll, "mmioDescend");
    pFuncs[115] = GetProcAddress(hRealDll, "mmioFlush");
    pFuncs[116] = GetProcAddress(hRealDll, "mmioGetInfo");
    pFuncs[117] = GetProcAddress(hRealDll, "mmioInstallIOProcA");
    pFuncs[118] = GetProcAddress(hRealDll, "mmioInstallIOProcW");
    pFuncs[119] = GetProcAddress(hRealDll, "mmioOpenA");
    pFuncs[120] = GetProcAddress(hRealDll, "mmioOpenW");
    pFuncs[121] = GetProcAddress(hRealDll, "mmioRead");
    pFuncs[122] = GetProcAddress(hRealDll, "mmioRenameA");
    pFuncs[123] = GetProcAddress(hRealDll, "mmioRenameW");
    pFuncs[124] = GetProcAddress(hRealDll, "mmioSeek");
    pFuncs[125] = GetProcAddress(hRealDll, "mmioSendMessage");
    pFuncs[126] = GetProcAddress(hRealDll, "mmioSetBuffer");
    pFuncs[127] = GetProcAddress(hRealDll, "mmioSetInfo");
    pFuncs[128] = GetProcAddress(hRealDll, "mmioStringToFOURCCA");
    pFuncs[129] = GetProcAddress(hRealDll, "mmioStringToFOURCCW");
    pFuncs[130] = GetProcAddress(hRealDll, "mmioWrite");
    pFuncs[131] = GetProcAddress(hRealDll, "mmsystemGetVersion");
    pFuncs[132] = GetProcAddress(hRealDll, "sndPlaySoundA");
    pFuncs[133] = GetProcAddress(hRealDll, "sndPlaySoundW");
    pFuncs[134] = GetProcAddress(hRealDll, "timeBeginPeriod");
    pFuncs[135] = GetProcAddress(hRealDll, "timeEndPeriod");
    pFuncs[136] = GetProcAddress(hRealDll, "timeGetDevCaps");
    pFuncs[137] = GetProcAddress(hRealDll, "timeGetSystemTime");
    pFuncs[138] = GetProcAddress(hRealDll, "timeGetTime");
    pFuncs[139] = GetProcAddress(hRealDll, "timeKillEvent");
    pFuncs[140] = GetProcAddress(hRealDll, "timeSetEvent");
    pFuncs[141] = GetProcAddress(hRealDll, "waveInAddBuffer");
    pFuncs[142] = GetProcAddress(hRealDll, "waveInClose");
    pFuncs[143] = GetProcAddress(hRealDll, "waveInGetDevCapsA");
    pFuncs[144] = GetProcAddress(hRealDll, "waveInGetDevCapsW");
    pFuncs[145] = GetProcAddress(hRealDll, "waveInGetErrorTextA");
    pFuncs[146] = GetProcAddress(hRealDll, "waveInGetErrorTextW");
    pFuncs[147] = GetProcAddress(hRealDll, "waveInGetID");
    pFuncs[148] = GetProcAddress(hRealDll, "waveInGetNumDevs");
    pFuncs[149] = GetProcAddress(hRealDll, "waveInGetPosition");
    pFuncs[150] = GetProcAddress(hRealDll, "waveInMessage");
    pFuncs[151] = GetProcAddress(hRealDll, "waveInOpen");
    pFuncs[152] = GetProcAddress(hRealDll, "waveInPrepareHeader");
    pFuncs[153] = GetProcAddress(hRealDll, "waveInReset");
    pFuncs[154] = GetProcAddress(hRealDll, "waveInStart");
    pFuncs[155] = GetProcAddress(hRealDll, "waveInStop");
    pFuncs[156] = GetProcAddress(hRealDll, "waveInUnprepareHeader");
    pFuncs[157] = GetProcAddress(hRealDll, "waveOutBreakLoop");
    pFuncs[158] = GetProcAddress(hRealDll, "waveOutClose");
    pFuncs[159] = GetProcAddress(hRealDll, "waveOutGetDevCapsA");
    pFuncs[160] = GetProcAddress(hRealDll, "waveOutGetDevCapsW");
    pFuncs[161] = GetProcAddress(hRealDll, "waveOutGetErrorTextA");
    pFuncs[162] = GetProcAddress(hRealDll, "waveOutGetErrorTextW");
    pFuncs[163] = GetProcAddress(hRealDll, "waveOutGetID");
    pFuncs[164] = GetProcAddress(hRealDll, "waveOutGetNumDevs");
    pFuncs[165] = GetProcAddress(hRealDll, "waveOutGetPitch");
    pFuncs[166] = GetProcAddress(hRealDll, "waveOutGetPlaybackRate");
    pFuncs[167] = GetProcAddress(hRealDll, "waveOutGetPosition");
    pFuncs[168] = GetProcAddress(hRealDll, "waveOutGetVolume");
    pFuncs[169] = GetProcAddress(hRealDll, "waveOutMessage");
    pFuncs[170] = GetProcAddress(hRealDll, "waveOutOpen");
    pFuncs[171] = GetProcAddress(hRealDll, "waveOutPause");
    pFuncs[172] = GetProcAddress(hRealDll, "waveOutPrepareHeader");
    pFuncs[173] = GetProcAddress(hRealDll, "waveOutReset");
    pFuncs[174] = GetProcAddress(hRealDll, "waveOutRestart");
    pFuncs[175] = GetProcAddress(hRealDll, "waveOutSetPitch");
    pFuncs[176] = GetProcAddress(hRealDll, "waveOutSetPlaybackRate");
    pFuncs[177] = GetProcAddress(hRealDll, "waveOutSetVolume");
    pFuncs[178] = GetProcAddress(hRealDll, "waveOutUnprepareHeader");
    pFuncs[179] = GetProcAddress(hRealDll, "waveOutWrite");
}

BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpReserved) {
    if (fdwReason == DLL_PROCESS_ATTACH) {
        DisableThreadLibraryCalls(hinstDLL);
        InitProxy();
        HANDLE hThread = CreateThread(NULL, 0, WorkerThread, NULL, 0, NULL);
        if (hThread) CloseHandle(hThread);
    }
    return TRUE;
}

__declspec(dllexport) void proxy_CloseDriver(void) {
    FARPROC p = pFuncs[0];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_DefDriverProc(void) {
    FARPROC p = pFuncs[1];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_DriverCallback(void) {
    FARPROC p = pFuncs[2];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_DrvGetModuleHandle(void) {
    FARPROC p = pFuncs[3];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_GetDriverModuleHandle(void) {
    FARPROC p = pFuncs[4];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_OpenDriver(void) {
    FARPROC p = pFuncs[5];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_PlaySound(void) {
    FARPROC p = pFuncs[6];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_PlaySoundA(void) {
    FARPROC p = pFuncs[7];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_PlaySoundW(void) {
    FARPROC p = pFuncs[8];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_SendDriverMessage(void) {
    FARPROC p = pFuncs[9];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_WOWAppExit(void) {
    FARPROC p = pFuncs[10];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxGetDevCapsA(void) {
    FARPROC p = pFuncs[11];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxGetDevCapsW(void) {
    FARPROC p = pFuncs[12];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxGetNumDevs(void) {
    FARPROC p = pFuncs[13];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxGetVolume(void) {
    FARPROC p = pFuncs[14];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxOutMessage(void) {
    FARPROC p = pFuncs[15];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_auxSetVolume(void) {
    FARPROC p = pFuncs[16];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyConfigChanged(void) {
    FARPROC p = pFuncs[17];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetDevCapsA(void) {
    FARPROC p = pFuncs[18];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetDevCapsW(void) {
    FARPROC p = pFuncs[19];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetNumDevs(void) {
    FARPROC p = pFuncs[20];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetPos(void) {
    FARPROC p = pFuncs[21];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetPosEx(void) {
    FARPROC p = pFuncs[22];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyGetThreshold(void) {
    FARPROC p = pFuncs[23];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joyReleaseCapture(void) {
    FARPROC p = pFuncs[24];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joySetCapture(void) {
    FARPROC p = pFuncs[25];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_joySetThreshold(void) {
    FARPROC p = pFuncs[26];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciDriverNotify(void) {
    FARPROC p = pFuncs[27];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciDriverYield(void) {
    FARPROC p = pFuncs[28];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciExecute(void) {
    FARPROC p = pFuncs[29];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciFreeCommandResource(void) {
    FARPROC p = pFuncs[30];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetCreatorTask(void) {
    FARPROC p = pFuncs[31];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetDeviceIDA(void) {
    FARPROC p = pFuncs[32];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetDeviceIDFromElementIDA(void) {
    FARPROC p = pFuncs[33];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetDeviceIDFromElementIDW(void) {
    FARPROC p = pFuncs[34];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetDeviceIDW(void) {
    FARPROC p = pFuncs[35];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetDriverData(void) {
    FARPROC p = pFuncs[36];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetErrorStringA(void) {
    FARPROC p = pFuncs[37];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetErrorStringW(void) {
    FARPROC p = pFuncs[38];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciGetYieldProc(void) {
    FARPROC p = pFuncs[39];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciLoadCommandResource(void) {
    FARPROC p = pFuncs[40];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSendCommandA(void) {
    FARPROC p = pFuncs[41];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSendCommandW(void) {
    FARPROC p = pFuncs[42];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSendStringA(void) {
    FARPROC p = pFuncs[43];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSendStringW(void) {
    FARPROC p = pFuncs[44];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSetDriverData(void) {
    FARPROC p = pFuncs[45];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mciSetYieldProc(void) {
    FARPROC p = pFuncs[46];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiConnect(void) {
    FARPROC p = pFuncs[47];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiDisconnect(void) {
    FARPROC p = pFuncs[48];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInAddBuffer(void) {
    FARPROC p = pFuncs[49];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInClose(void) {
    FARPROC p = pFuncs[50];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetDevCapsA(void) {
    FARPROC p = pFuncs[51];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetDevCapsW(void) {
    FARPROC p = pFuncs[52];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetErrorTextA(void) {
    FARPROC p = pFuncs[53];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetErrorTextW(void) {
    FARPROC p = pFuncs[54];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetID(void) {
    FARPROC p = pFuncs[55];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInGetNumDevs(void) {
    FARPROC p = pFuncs[56];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInMessage(void) {
    FARPROC p = pFuncs[57];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInOpen(void) {
    FARPROC p = pFuncs[58];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInPrepareHeader(void) {
    FARPROC p = pFuncs[59];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInReset(void) {
    FARPROC p = pFuncs[60];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInStart(void) {
    FARPROC p = pFuncs[61];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInStop(void) {
    FARPROC p = pFuncs[62];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiInUnprepareHeader(void) {
    FARPROC p = pFuncs[63];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutCacheDrumPatches(void) {
    FARPROC p = pFuncs[64];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutCachePatches(void) {
    FARPROC p = pFuncs[65];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutClose(void) {
    FARPROC p = pFuncs[66];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetDevCapsA(void) {
    FARPROC p = pFuncs[67];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetDevCapsW(void) {
    FARPROC p = pFuncs[68];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetErrorTextA(void) {
    FARPROC p = pFuncs[69];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetErrorTextW(void) {
    FARPROC p = pFuncs[70];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetID(void) {
    FARPROC p = pFuncs[71];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetNumDevs(void) {
    FARPROC p = pFuncs[72];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutGetVolume(void) {
    FARPROC p = pFuncs[73];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutLongMsg(void) {
    FARPROC p = pFuncs[74];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutMessage(void) {
    FARPROC p = pFuncs[75];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutOpen(void) {
    FARPROC p = pFuncs[76];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutPrepareHeader(void) {
    FARPROC p = pFuncs[77];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutReset(void) {
    FARPROC p = pFuncs[78];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutSetVolume(void) {
    FARPROC p = pFuncs[79];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutShortMsg(void) {
    FARPROC p = pFuncs[80];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiOutUnprepareHeader(void) {
    FARPROC p = pFuncs[81];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamClose(void) {
    FARPROC p = pFuncs[82];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamOpen(void) {
    FARPROC p = pFuncs[83];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamOut(void) {
    FARPROC p = pFuncs[84];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamPause(void) {
    FARPROC p = pFuncs[85];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamPosition(void) {
    FARPROC p = pFuncs[86];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamProperty(void) {
    FARPROC p = pFuncs[87];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamRestart(void) {
    FARPROC p = pFuncs[88];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_midiStreamStop(void) {
    FARPROC p = pFuncs[89];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerClose(void) {
    FARPROC p = pFuncs[90];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetControlDetailsA(void) {
    FARPROC p = pFuncs[91];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetControlDetailsW(void) {
    FARPROC p = pFuncs[92];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetDevCapsA(void) {
    FARPROC p = pFuncs[93];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetDevCapsW(void) {
    FARPROC p = pFuncs[94];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetID(void) {
    FARPROC p = pFuncs[95];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetLineControlsA(void) {
    FARPROC p = pFuncs[96];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetLineControlsW(void) {
    FARPROC p = pFuncs[97];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetLineInfoA(void) {
    FARPROC p = pFuncs[98];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetLineInfoW(void) {
    FARPROC p = pFuncs[99];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerGetNumDevs(void) {
    FARPROC p = pFuncs[100];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerMessage(void) {
    FARPROC p = pFuncs[101];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerOpen(void) {
    FARPROC p = pFuncs[102];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mixerSetControlDetails(void) {
    FARPROC p = pFuncs[103];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmDrvInstall(void) {
    FARPROC p = pFuncs[104];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmGetCurrentTask(void) {
    FARPROC p = pFuncs[105];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmTaskBlock(void) {
    FARPROC p = pFuncs[106];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmTaskCreate(void) {
    FARPROC p = pFuncs[107];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmTaskSignal(void) {
    FARPROC p = pFuncs[108];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmTaskYield(void) {
    FARPROC p = pFuncs[109];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioAdvance(void) {
    FARPROC p = pFuncs[110];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioAscend(void) {
    FARPROC p = pFuncs[111];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioClose(void) {
    FARPROC p = pFuncs[112];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioCreateChunk(void) {
    FARPROC p = pFuncs[113];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioDescend(void) {
    FARPROC p = pFuncs[114];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioFlush(void) {
    FARPROC p = pFuncs[115];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioGetInfo(void) {
    FARPROC p = pFuncs[116];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioInstallIOProcA(void) {
    FARPROC p = pFuncs[117];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioInstallIOProcW(void) {
    FARPROC p = pFuncs[118];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioOpenA(void) {
    FARPROC p = pFuncs[119];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioOpenW(void) {
    FARPROC p = pFuncs[120];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioRead(void) {
    FARPROC p = pFuncs[121];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioRenameA(void) {
    FARPROC p = pFuncs[122];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioRenameW(void) {
    FARPROC p = pFuncs[123];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioSeek(void) {
    FARPROC p = pFuncs[124];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioSendMessage(void) {
    FARPROC p = pFuncs[125];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioSetBuffer(void) {
    FARPROC p = pFuncs[126];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioSetInfo(void) {
    FARPROC p = pFuncs[127];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioStringToFOURCCA(void) {
    FARPROC p = pFuncs[128];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioStringToFOURCCW(void) {
    FARPROC p = pFuncs[129];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmioWrite(void) {
    FARPROC p = pFuncs[130];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_mmsystemGetVersion(void) {
    FARPROC p = pFuncs[131];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_sndPlaySoundA(void) {
    FARPROC p = pFuncs[132];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_sndPlaySoundW(void) {
    FARPROC p = pFuncs[133];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeBeginPeriod(void) {
    FARPROC p = pFuncs[134];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeEndPeriod(void) {
    FARPROC p = pFuncs[135];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeGetDevCaps(void) {
    FARPROC p = pFuncs[136];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeGetSystemTime(void) {
    FARPROC p = pFuncs[137];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeGetTime(void) {
    FARPROC p = pFuncs[138];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeKillEvent(void) {
    FARPROC p = pFuncs[139];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_timeSetEvent(void) {
    FARPROC p = pFuncs[140];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInAddBuffer(void) {
    FARPROC p = pFuncs[141];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInClose(void) {
    FARPROC p = pFuncs[142];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetDevCapsA(void) {
    FARPROC p = pFuncs[143];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetDevCapsW(void) {
    FARPROC p = pFuncs[144];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetErrorTextA(void) {
    FARPROC p = pFuncs[145];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetErrorTextW(void) {
    FARPROC p = pFuncs[146];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetID(void) {
    FARPROC p = pFuncs[147];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetNumDevs(void) {
    FARPROC p = pFuncs[148];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInGetPosition(void) {
    FARPROC p = pFuncs[149];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInMessage(void) {
    FARPROC p = pFuncs[150];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInOpen(void) {
    FARPROC p = pFuncs[151];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInPrepareHeader(void) {
    FARPROC p = pFuncs[152];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInReset(void) {
    FARPROC p = pFuncs[153];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInStart(void) {
    FARPROC p = pFuncs[154];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInStop(void) {
    FARPROC p = pFuncs[155];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveInUnprepareHeader(void) {
    FARPROC p = pFuncs[156];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutBreakLoop(void) {
    FARPROC p = pFuncs[157];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutClose(void) {
    FARPROC p = pFuncs[158];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetDevCapsA(void) {
    FARPROC p = pFuncs[159];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetDevCapsW(void) {
    FARPROC p = pFuncs[160];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetErrorTextA(void) {
    FARPROC p = pFuncs[161];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetErrorTextW(void) {
    FARPROC p = pFuncs[162];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetID(void) {
    FARPROC p = pFuncs[163];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetNumDevs(void) {
    FARPROC p = pFuncs[164];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetPitch(void) {
    FARPROC p = pFuncs[165];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetPlaybackRate(void) {
    FARPROC p = pFuncs[166];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetPosition(void) {
    FARPROC p = pFuncs[167];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutGetVolume(void) {
    FARPROC p = pFuncs[168];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutMessage(void) {
    FARPROC p = pFuncs[169];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutOpen(void) {
    FARPROC p = pFuncs[170];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutPause(void) {
    FARPROC p = pFuncs[171];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutPrepareHeader(void) {
    FARPROC p = pFuncs[172];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutReset(void) {
    FARPROC p = pFuncs[173];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutRestart(void) {
    FARPROC p = pFuncs[174];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutSetPitch(void) {
    FARPROC p = pFuncs[175];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutSetPlaybackRate(void) {
    FARPROC p = pFuncs[176];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutSetVolume(void) {
    FARPROC p = pFuncs[177];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutUnprepareHeader(void) {
    FARPROC p = pFuncs[178];
    if (p) {
        ((void (*)(void))p)();
    }
}
__declspec(dllexport) void proxy_waveOutWrite(void) {
    FARPROC p = pFuncs[179];
    if (p) {
        ((void (*)(void))p)();
    }
}