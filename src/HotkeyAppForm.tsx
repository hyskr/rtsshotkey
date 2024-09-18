import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X } from 'lucide-react';

import { Store } from '@tauri-apps/plugin-store';
import { register, isRegistered, unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { Command } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';

const store = new Store('store.dat');

const RTSSHotkeyForm = () => {
  const [hotkey, setHotkey] = useState('');
  const [appName, setAppName] = useState('');
  const [frameRate, setFrameRate] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [pressDuration, setPressDuration] = useState(0);
  const [pressStartTime, setPressStartTime] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      setLoaded(true);
    }
  }, [isAdmin]);


  const checkAdminStatus = async () => {
    try {
      const adminStatus = await invoke('check_admin_status');
      if (!adminStatus) {
      } else {
        setIsAdmin(true);
        addLog('应用程序正在以管理员权限运行');
      }
    } catch (error) {
      addLog('检查或提升管理员状态失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
    }
  };

  useEffect(() => {
    if (isRunning) {
      registerHotkey();
    } else {
      unregisterHotkey();
    }
    return () => {
      if (isRunning) {
        unregisterHotkey();
      }
    };
  }, [isRunning]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (message: any) => {
    setLogs(prevLogs => [...prevLogs, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const loadSettings = async () => {
    try {
      const loadedHotkey = (await store.get('hotkey')) as string | null;
      const loadedAppName = (await store.get('appName')) as string | null;
      const loadedFrameRate = (await store.get('frameRate')) as string | null;

      setHotkey(loadedHotkey ?? 'CapsLock');
      setAppName(loadedAppName ?? 'NarakaBladepoint.exe');
      setFrameRate(loadedFrameRate ?? '20');
      addLog('设置加载成功');
    } catch (error) {
      addLog('加载设置失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
    }
  };

  const resetSetting = async () => {
    try {
      setHotkey('CapsLock');
      setAppName('Global');
      setFrameRate('10');
      addLog('恢复默认设置');
    } catch (error) {
      addLog('加载设置失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
    }
  };

  const saveSettings = async () => {
    try {
      await store.set('hotkey', hotkey);
      await store.set('appName', appName);
      await store.set('frameRate', frameRate);
      await store.save();
      addLog('设置保存成功');
    } catch (error) {
      addLog('保存设置失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
    }
  };

  const executeRTSSCommand = async (args: any[]) => {
    try {
      const command = Command.sidecar('resources/rtss-cli', [
        ...args
      ]);
      const output = await command.execute();
      addLog(`RTSS命令执行: ${args.join(' ')}`);
      const strippedOutput = output.stdout.trim();
      addLog(`RTSS命令输出: ${strippedOutput}`);
    } catch (error) {
      addLog('执行RTSS命令失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
    }
  };

  const registerHotkey = async () => {
    try {
      await register(hotkey, async (event) => {
        if (event.state === 'Pressed') {
          addLog(`热键 ${hotkey} 已按下`);
          setPressStartTime(Date.now());
          // 按下时设置帧率限制
          if (appName !== 'Global') {
            await executeRTSSCommand(['property:set', appName, 'FramerateLimit', frameRate]);
          } else {
            await executeRTSSCommand(['limit:set', frameRate]);
          }
        } else if (event.state === 'Released') {
          addLog(`热键 ${hotkey} 已释放`);
          if (appName !== 'Global') {
            await executeRTSSCommand(['property:set', appName, 'FramerateLimit', '0']);
          } else {
            await executeRTSSCommand(['limit:set', '0']);
          }
          if (pressStartTime) {
            const duration = Date.now() - pressStartTime;
            setPressDuration(duration);
            setPressStartTime(null);
            addLog(`按键持续时间: ${duration}毫秒`);
          }
        }
      });
      addLog(`热键 ${hotkey} 注册成功`);
    } catch (error) {
      addLog(`热键 ${hotkey} 注册失败, ${error}`);
      addLog(`停止监控`);
      setIsRunning(false);
    }
  };

  const unregisterHotkey = async () => {
    if (loaded === false) {
      return;
    }
    if (await isRegistered(hotkey)) {
      addLog(`注销热键: ${hotkey}`);
      try {
        await unregisterAll();
        addLog(`热键 ${hotkey} 注销成功`);
      } catch (error) {
        addLog('注销热键失败: ' + (error as { message?: string }).message || 'An unknown error occurred');
      }
    } else {
      addLog(`热键 ${hotkey} 未注册`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    console.log('Key pressed:', e.key);
    e.preventDefault();
    const { key, ctrlKey, altKey, shiftKey, metaKey } = e;

    if (key === 'Backspace') {
      setHotkey('');
      return;
    }

    let newHotkey = [];
    if (ctrlKey) newHotkey.push('Ctrl');
    if (altKey) newHotkey.push('Alt');
    if (shiftKey) newHotkey.push('Shift');
    if (metaKey) newHotkey.push('Meta');

    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      newHotkey.push(key);
    }

    setHotkey(newHotkey.join('+'));
  };

  const clearHotkey = () => {
    setHotkey('');
    hotkeyInputRef.current?.focus();
  };

  const handleStart = async () => {
    if (hotkey && appName && frameRate) {
      await saveSettings();
      if (appName !== 'Global') {
        await executeRTSSCommand(['property:set', appName, 'FramerateLimit', '0']);
      } else {
        await executeRTSSCommand(['limit:set', '0']);
      }
      addLog('开始监控');
      setIsRunning(true);
    }
  };

  const handleStop = async () => {
    setIsRunning(false);
    // 重置RTSS设置
    if (appName !== 'Global') {
      await executeRTSSCommand(['property:set', appName, 'FramerateLimit', '0']);
    } else {
      await executeRTSSCommand(['limit:set', '0']);
    }
    addLog('停止监控');
  };

  useEffect(() => {
    console.log('Effect running, ref:', hotkeyInputRef.current);

    const currentRef = hotkeyInputRef.current;
    if (currentRef) {
      currentRef.addEventListener('keydown', handleKeyDown);
      console.log('Keydown listener added');

      return () => {
        currentRef.removeEventListener('keydown', handleKeyDown);
        console.log('Keydown listener removed');
      };
    } else {
      console.warn('hotkeyInputRef is not available');
    }
  }, [hotkeyInputRef.current]);


  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <Alert>
          <AlertDescription>
            应用程序不是以管理员权限运行，请退出以管理员权限运行
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">RTSS 热键帧率限制器</h2>

      <div className="space-y-4">
        <div>
          <Label htmlFor="hotkey">热键</Label>
          <div className="relative">
            <Input
              id="hotkey"
              ref={hotkeyInputRef}
              value={hotkey}
              onChange={() => { }}
              placeholder="点击此处并按下按键组合"
              className="pr-10"
              disabled={isRunning}
            />
            {hotkey && !isRunning && (
              <Button
                type="button"
                variant="ghost"
                className="absolute right-0 top-0 h-full px-3"
                onClick={clearHotkey}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="appName">应用程序名称</Label>
          <Input
            id="appName"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="输入应用程序名称或 'Global'"
            disabled={isRunning}
          />
        </div>

        <div>
          <Label htmlFor="frameRate">帧率限制</Label>
          <Input
            id="frameRate"
            type="number"
            value={frameRate}
            onChange={(e) => setFrameRate(e.target.value)}
            placeholder="输入帧率限制"
            disabled={isRunning}
          />
        </div>

        <div className="flex space-x-4">
          <Button onClick={resetSetting} disabled={isRunning}>默认设置</Button>
          {!isRunning ? (
            <Button onClick={handleStart} disabled={!hotkey || !appName || !frameRate}>开始监控</Button>
          ) : (
            <Button onClick={handleStop} disabled={!hotkey || !appName || !frameRate}>停止监控</Button>
          )}
        </div>
      </div>

      {
        isRunning && (
          <Alert className="mt-4">
            <AlertDescription>
              监控中：热键: {hotkey}, 应用: {appName}, 帧率限制: {frameRate}
              {pressDuration > 0 && <div>上次按键持续时间: {pressDuration}毫秒</div>}
            </AlertDescription>
          </Alert>
        )
      }

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">日志</h3>
        <div className="bg-gray-100 p-2 rounded-md h-40 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="text-sm">{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div >
  );
};

export default RTSSHotkeyForm;